#!/usr/bin/env python3
"""Research public nature POIs and cache them as unverified scout spots."""

import argparse
import json
import math
import pathlib
import socket
import time
import urllib.parse
import urllib.request
import urllib.error

PROJECT_URL = "https://cpnxysplsqolgvurezpe.supabase.co"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
OVERPASS_TIMEOUT = 18
OVERPASS_QUERY_TIMEOUT = 14
LOCAL_STATE_DIR = pathlib.Path(__file__).parents[1] / ".local"
IMPORT_KEY_FILE = LOCAL_STATE_DIR / "spot-import-key"


def request_json(url, *, data=None, headers=None, timeout=45):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error


def public_key():
    config = pathlib.Path(__file__).parents[1] / "supabase-config.js"
    for line in config.read_text().splitlines():
        if "publishableKey:" in line:
            return line.split('"')[1]
    raise RuntimeError("Publishable key not found")


def authenticate(key):
    return request_json(
        f"{PROJECT_URL}/auth/v1/signup",
        data={},
        headers={"apikey": key, "Content-Type": "application/json"},
    )["access_token"]


def research_via_edge_function(lat, lng, key, token):
    """Use the deployed importer when local Overpass TLS routes are unavailable.

    The Edge Function applies the same amber/unverified policy and persists the
    returned candidates, so callers must not import the response a second time.
    """
    result = request_json(
        f"{PROJECT_URL}/functions/v1/discover-spots",
        data={"lat": lat, "lng": lng, "radius": 50000},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=50,
    )
    return result.get("spots", [])


def query(lat, lng):
    return f"""[out:json][timeout:{OVERPASS_QUERY_TIMEOUT}];
(
  nwr(around:50000,{lat},{lng})["tourism"="viewpoint"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["tourism"="picnic_site"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["leisure"="bird_hide"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["shelter_type"="picnic_shelter"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["natural"="beach"]["access"!="private"]["access"!="no"];
);
out center tags;"""


def coastline_query(lat, lng):
    return f"""[out:json][timeout:{OVERPASS_QUERY_TIMEOUT}];
way(around:52000,{lat},{lng})["natural"="coastline"];
out geom;"""


def distance_km(a, b):
    radius = 6371
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    delta_lat = lat2 - lat1
    delta_lng = math.radians(b[1] - a[1])
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def coastline_points(elements):
    return [
        (point["lat"], point["lon"])
        for element in elements
        if element.get("tags", {}).get("natural") == "coastline"
        for point in element.get("geometry", [])
    ]


def is_coastal(lat, lng, coast):
    return any(distance_km((lat, lng), point) <= 2 for point in coast)


def category(tags, coastal=False):
    if tags.get("tourism") == "viewpoint":
        return "wald", "🌅", "Aussichtspunkt"
    if tags.get("tourism") == "picnic_site":
        return "wald", "🧺", "Picknickplatz"
    if tags.get("leisure") == "bird_hide":
        return "see", "🦆", "Vogelbeobachtung"
    if tags.get("shelter_type") == "picnic_shelter":
        return "wald", "🌲", "Schutzhütte"
    if tags.get("natural") == "beach":
        return (
            ("meer", "🌊", "Meeresstrand")
            if coastal
            else ("see", "🦆", "Badestrand am Binnengewässer")
        )
    return "wald", "🌲", "Naturort"


def spot(element, coast):
    lat = element.get("lat", element.get("center", {}).get("lat"))
    lng = element.get("lon", element.get("center", {}).get("lon"))
    if lat is None or lng is None:
        return None
    tags = element.get("tags", {})
    if tags.get("natural") == "coastline":
        return None
    kind, icon, title = category(tags, is_coastal(lat, lng, coast))
    return {
        "id": f"osm-{element['type']}-{element['id']}",
        "name": tags.get("name") or tags.get("name:de") or title,
        "type": kind,
        "icon": icon,
        "lat": lat,
        "lng": lng,
        "access": "Zufahrt und Parkmöglichkeit vor Ort prüfen",
        "status": "amber",
        "label": "Ungeprüfter Scout-Ort",
        "note": f"{title} aus OpenStreetMap. Keine bestätigte Übernachtungserlaubnis; Beschilderung, Schutzstatus, Eigentum und Zufahrt vor Ort prüfen.",
        "source": "OpenStreetMap",
        "source_url": f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
    }


def research(lat, lng):
    errors = []
    for endpoint in OVERPASS:
        try:
            def fetch(overpass_query):
                req = urllib.request.Request(
                    endpoint,
                    data=urllib.parse.urlencode({"data": overpass_query}).encode(),
                    headers={"User-Agent": "RoofTentFieldManual/1.0"},
                )
                with urllib.request.urlopen(req, timeout=OVERPASS_TIMEOUT) as response:
                    return json.load(response)["elements"]

            elements = fetch(query(lat, lng))
            try:
                coast = coastline_points(fetch(coastline_query(lat, lng)))
            except Exception:
                # Eine optionale Küstenklassifizierung darf bereits geladene
                # Binnenland-Kandidaten nicht verwerfen.
                coast = []
            return [
                item
                for item in (spot(element, coast) for element in elements)
                if item
            ]
        except (TimeoutError, socket.timeout, urllib.error.URLError,
                urllib.error.HTTPError, json.JSONDecodeError) as error:
            errors.append(f"{endpoint}: {error}")
            continue
    raise RuntimeError("No research provider available: " + " | ".join(errors))


def rectangle_grid(south, north, west, east):
    points = []
    lat = south
    while lat <= north:
        step_lng = 0.9 / max(0.65, math.cos(math.radians(lat)))
        lng = west
        while lng <= east:
            points.append((round(lat, 3), round(lng, 3)))
            lng += step_lng
        lat += 0.72
    return points


def grid(region):
    if region == "focus":
        # Polen, Tschechien, Österreich und Slowenien – bewusst vor dem
        # großflächigen Europa-Raster recherchieren.
        bounds = (
            (49.0, 55.0, 14.0, 24.3),  # Polen
            (48.5, 51.2, 12.0, 18.9),  # Tschechien
            (46.3, 49.1, 9.4, 17.2),   # Österreich
            (45.4, 47.0, 13.3, 16.7),  # Slowenien
        )
        unique = {
            point
            for country_bounds in bounds
            for point in rectangle_grid(*country_bounds)
        }
        return sorted(unique)
    if region == "france-italy":
        bounds = (
            (41.2, 51.2, -5.3, 9.7),  # Frankreich einschließlich Korsika
            (36.6, 47.2, 6.6, 18.7),  # Italien einschließlich Inseln
        )
        unique = {
            point
            for country_bounds in bounds
            for point in rectangle_grid(*country_bounds)
        }
        return sorted(unique)
    if region == "europe":
        return rectangle_grid(34.4, 71.2, -11.0, 47.5)
    return rectangle_grid(47.4, 55.1, 5.9, 15.1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument(
        "--region",
        choices=("germany", "focus", "france-italy", "europe"),
        default="germany",
    )
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lng", type=float)
    parser.add_argument(
        "--continue-on-provider-error",
        action="store_true",
        help="Record a failed grid point and continue with the next point.",
    )
    args = parser.parse_args()
    LOCAL_STATE_DIR.mkdir(mode=0o700, exist_ok=True)
    state_file = LOCAL_STATE_DIR / f"seed-{args.region}.json"
    temporary_state_file = pathlib.Path(f"/tmp/roof-tent-field-manual-seed-{args.region}.json")
    previous_state_file = pathlib.Path(f"/tmp/scandinavian-field-manual-seed-{args.region}.json")
    if not state_file.exists():
        for legacy_file in (temporary_state_file, previous_state_file):
            if legacy_file.exists():
                state_file.write_text(legacy_file.read_text())
                break
    state = json.loads(state_file.read_text()) if state_file.exists() else {"next": 0, "imported": 0}
    points = grid(args.region)
    key = public_key()
    token = authenticate(key)
    import_key = IMPORT_KEY_FILE.read_text().strip()
    completed = 0

    requested_center = (args.lat, args.lng) if args.lat is not None and args.lng is not None else None
    while completed < args.batch and (requested_center or state["next"] < len(points)):
        lat, lng = requested_center or points[state["next"]]
        imported_remotely = False
        try:
            candidates = research(lat, lng)
        except RuntimeError as error:
            try:
                candidates = research_via_edge_function(lat, lng, key, token)
                imported_remotely = True
            except Exception as fallback_error:
                if not args.continue_on_provider_error or requested_center:
                    raise RuntimeError(
                        f"Local and Edge research unavailable: {error}; "
                        f"fallback: {fallback_error}"
                    ) from fallback_error
                state.setdefault("failed", []).append({
                    "index": state["next"],
                    "lat": lat,
                    "lng": lng,
                    "error": f"{error}; edge: {fallback_error}"[:500],
                })
                state["next"] += 1
                completed += 1
                state_file.write_text(json.dumps(state))
                print(json.dumps({
                    "skipped": state["next"] - 1,
                    "lat": lat,
                    "lng": lng,
                    "reason": "provider_error",
                }), flush=True)
                continue
        if imported_remotely:
            state["imported"] += len(candidates)
        else:
            for start in range(0, len(candidates), 500):
                result = request_json(
                    f"{PROJECT_URL}/functions/v1/discover-spots",
                    data={"spots": candidates[start:start + 500], "importKey": import_key},
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=45,
                )
                state["imported"] += result.get("imported", 0)
        if requested_center:
            completed += 1
            break
        state["next"] += 1
        completed += 1
        state_file.write_text(json.dumps(state))
        print(json.dumps({
            "completed": state["next"],
            "total": len(points),
            "imported": state["imported"],
        }), flush=True)
        time.sleep(2)

    print(json.dumps({
        "gridCompleted": state["next"],
        "gridTotal": len(points),
        "recordsProcessed": state["imported"],
    }))


if __name__ == "__main__":
    main()
