import { withSupabase } from "jsr:@supabase/server@^1";

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function query(lat: number, lng: number, radius: number) {
  return `[out:json][timeout:22];
(
  nwr(around:${radius},${lat},${lng})["tourism"="viewpoint"]["access"!="private"]["access"!="no"];
  nwr(around:${radius},${lat},${lng})["tourism"="picnic_site"]["access"!="private"]["access"!="no"];
  nwr(around:${radius},${lat},${lng})["amenity"="picnic_table"]["access"!="private"]["access"!="no"];
  nwr(around:${radius},${lat},${lng})["leisure"="bird_hide"]["access"!="private"]["access"!="no"];
  nwr(around:${radius},${lat},${lng})["shelter_type"="picnic_shelter"]["access"!="private"]["access"!="no"];
  nwr(around:${radius},${lat},${lng})["natural"="beach"]["access"!="private"]["access"!="no"];
);
out center tags;`;
}

function category(tags: Record<string, string>) {
  if (tags.tourism === "viewpoint") return { type: "wald", icon: "🌅", title: "Aussichtspunkt" };
  if (tags.tourism === "picnic_site" || tags.amenity === "picnic_table") return { type: "wald", icon: "🧺", title: "Picknickplatz" };
  if (tags.leisure === "bird_hide") return { type: "see", icon: "🦆", title: "Vogelbeobachtung" };
  if (tags.shelter_type === "picnic_shelter") return { type: "wald", icon: "🌲", title: "Schutzhütte" };
  if (tags.natural === "beach") return { type: "meer", icon: "🌊", title: "Strand" };
  return { type: "wald", icon: "🌲", title: "Naturort" };
}

function toSpot(element: any) {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tags = element.tags || {};
  const kind = category(tags);
  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name || tags["name:de"] || kind.title,
    type: kind.type,
    icon: kind.icon,
    lat,
    lng,
    access: "Zufahrt und Parkmöglichkeit vor Ort prüfen",
    status: "amber",
    label: "Ungeprüfter Scout-Ort",
    note: `${kind.title} aus OpenStreetMap. Keine bestätigte Übernachtungserlaubnis; Beschilderung, Schutzstatus, Eigentum und Zufahrt vor Ort prüfen.`,
    source: "OpenStreetMap",
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    discovered: true,
    updated_at: new Date().toISOString(),
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
  try {
    const body = await request.json();
    if (Array.isArray(body.spots)) {
      if (!body.importKey || body.importKey !== Deno.env.get("SPOT_IMPORT_KEY")) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const imported = body.spots.slice(0, 500).map((spot: any) => ({
        ...spot,
        status: "amber",
        label: "Ungeprüfter Scout-Ort",
        discovered: true,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await ctx.supabaseAdmin.from("spots").upsert(imported, { onConflict: "id" });
      if (error) throw error;
      return Response.json({ imported: imported.length });
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radius = Math.min(50000, Math.max(1000, Number(body.radius) || 15000));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid coordinates");

    let elements: any[] | null = null;
    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "ScandinavianFieldManual/1.0 (GitHub Pages nature spot research)",
          },
          body: new URLSearchParams({ data: query(lat, lng, radius) }),
          signal: controller.signal,
        });
        if (!response.ok) continue;
        elements = (await response.json()).elements || [];
        break;
      } catch {
        // Try the next provider.
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!elements) throw new Error("Research providers unavailable");

    const center = { lat, lng };
    const spots = elements
      .map(toSpot)
      .filter(Boolean)
      .sort((a: any, b: any) => distanceKm(center, a) - distanceKm(center, b))
      .slice(0, 80);

    if (spots.length) {
      const { error } = await ctx.supabaseAdmin.from("spots").upsert(spots, { onConflict: "id" });
      if (error) throw error;
    }

    return Response.json({ spots }, {
      headers: { "Cache-Control": "public, max-age=900" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, {
      status: 503,
    });
  }
  }),
};
