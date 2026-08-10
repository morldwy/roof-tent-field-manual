#!/usr/bin/env python3
"""Research public nature POIs and cache them as unverified scout spots."""

import argparse
import json
import math
import pathlib
import time
import urllib.parse
import urllib.request
import urllib.error

PROJECT_URL = "https://cpnxysplsqolgvurezpe.supabase.co"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
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


def query(lat, lng):
    return f"""[out:json][timeout:28];
(
  nwr(around:50000,{lat},{lng})["tourism"="viewpoint"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["tourism"="picnic_site"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["leisure"="bird_hide"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["shelter_type"="picnic_shelter"]["access"!="private"]["access"!="no"];
  nwr(around:50000,{lat},{lng})["natural"="beach"]["access"!="private"]["access"!="no"];
);
out center tags;"""


def coastline_query(lat, lng):
    return f"""[out:json][timeout:28];
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
    for endpoint in OVERPASS:
        try:
            def fetch(overpass_query):
                req = urllib.request.Request(
                    endpoint,
                    data=urllib.parse.urlencode({"data": overpass_query}).encode(),
                    headers={"User-Agent": "RoofTentFieldManual/1.0"},
                )
                with urllib.request.urlopen(req, timeout=40) as response:
                    return json.load(response)["elements"]

            elements = fetch(query(lat, lng))
            coast = coastline_points(fetch(coastline_query(lat, lng)))
            return [
                item
                for item in (spot(element, coast) for element in elements)
                if item
            ]
        except Exception:
            continue
    raise RuntimeError("No research provider available")


def grid(region):
    if region == "europe":
        south, north, west, east = 34.4, 71.2, -11.0, 47.5
    else:
        south, north, west, east = 47.4, 55.1, 5.9, 15.1
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--region", choices=("germany", "europe"), default="germany")
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lng", type=float)
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
        candidates = research(lat, lng)
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
        time.sleep(2)

    print(json.dumps({
        "gridCompleted": state["next"],
        "gridTotal": len(points),
        "recordsProcessed": state["imported"],
    }))


if __name__ == "__main__":
    main()
