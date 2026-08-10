import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("both routes expose working reciprocal navigation", async () => {
  const [index, guide] = await Promise.all([read("index.html"), read("guide.html")]);
  assert.match(index, /href="guide\.html"/);
  assert.match(guide, /href="index\.html"/);
  assert.match(index, /aria-current="page"/);
  assert.match(guide, /aria-current="page"/);
});

test("Supabase loads through the central browser adapter", async () => {
  const [index, guide, backend] = await Promise.all([
    read("index.html"),
    read("guide.html"),
    read("backend.js")
  ]);
  for (const html of [index, guide]) {
    assert.ok(html.indexOf("supabase-config.js") < html.indexOf("backend.js"));
  }
  assert.match(backend, /ensureAnonymousSession/);
  assert.doesNotMatch(backend, /service[_-]?role/i);
});

test("map, filters, search and guide UGC remain present", async () => {
  const [index, guide] = await Promise.all([read("index.html"), read("guide.html")]);
  assert.match(index, /id="map"/);
  assert.match(index, /id="spot-search"/);
  assert.match(index, /aria-autocomplete="list"/);
  assert.match(index, /id="search-suggestions"/);
  assert.match(index, /data-filter="meer"/);
  assert.match(index, /data-permission="amber"/);
  assert.match(index, /data-toilet="nearby"/);
  assert.match(index, /verantwortungsvollen Übernachten in deinem Dachzelt/);
  assert.match(guide, /id="tip-form"/);
  assert.match(guide, /data-check="roof-locks"/);
});

test("guide includes a practical and sourced sanitation chapter", async () => {
  const [guide, guideScript] = await Promise.all([read("guide.html"), read("guide.js")]);
  assert.match(guide, /id="sanitation"/);
  assert.match(guide, /Nacht-Toilettenkit/);
  assert.match(guide, /Human-Waste-Beutel/);
  assert.match(guide, /Einfach und bequem/);
  assert.match(guide, /Einfach und unkonventionell/);
  assert.match(guide, /Bequem und unkonventionell/);
  assert.match(guide, /Gel-Urinalbeutel/);
  assert.match(guide, /PET-Bidetadapter/);
  assert.match(guide, /HappyPo/);
  assert.match(guide, /Trockentrenntoilette/);
  assert.match(guide, /Outdoor entledigen/);
  assert.match(guide, /cdc\.gov\/norovirus/);
  assert.match(guide, /nps\.gov\/articles/);
  assert.match(guide, /data-check="sanitary-waste"/);
  assert.match(guideScript, /sanitation: "Sanitär & Hygiene"/);
});

test("purchase recommendations are Supabase-managed and admin-only writable", async () => {
  const [guide, guideScript, admin, adminScript, sql] = await Promise.all([
    read("guide.html"), read("guide.js"), read("admin.html"), read("admin.js"), read("supabase-guide-products-setup.sql")
  ]);
  assert.match(guide, /id="guide-products"/);
  assert.match(guideScript, /from\("guide_products"\)/);
  assert.match(guideScript, /\.eq\("enabled", true\)/);
  assert.match(admin, /id="admin-products"/);
  assert.match(adminScript, /from\("app_admins"\)/);
  assert.match(adminScript, /signInWithOtp/);
  assert.match(sql, /alter table public\.guide_products enable row level security/);
  assert.match(sql, /exists \(select 1 from public\.app_admins/);
  assert.match(sql, /Thetford Porta Potti 335/);
  assert.doesNotMatch(sql, /service[_-]?role/i);
});

test("spot cards and details include nearby OSM toilets and opening hours", async () => {
  const [app, index] = await Promise.all([read("app.js"), read("index.html")]);
  assert.match(app, /function loadNearbyToilets/);
  assert.match(app, /amenity.{0,20}toilets/);
  assert.match(app, /opening_hours/);
  assert.match(app, /function nearestToilets/);
  assert.match(app, /Toiletten in der Nähe/);
  assert.match(app, /activeToiletFilter/);
  assert.match(index, /overpass-api\.de/);
});

test("spot search provides ranked keyboard-accessible autocomplete", async () => {
  const app = await read("app.js");
  assert.match(app, /function searchScore/);
  assert.match(app, /function renderSuggestions/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /aria-activedescendant/);
  assert.match(app, /selectSuggestion/);
  assert.match(app, /requestAnimationFrame/);
});

test("map limits detail lists to 25 km and clusters markers by zoom", async () => {
  const [app, index] = await Promise.all([read("app.js"), read("index.html")]);
  assert.match(app, /DETAIL_RADIUS_KM = 25/);
  assert.match(app, /CLUSTER_RADIUS_KM = 25/);
  assert.match(app, /function clusterSpots/);
  assert.match(app, /function clusterRadiusForZoom/);
  assert.match(app, /map\.getZoom\(\) >= 13/);
  assert.match(app, /function syncContextMarkers/);
  assert.match(app, /cluster\.spots\.length/);
  assert.match(app, /const contextualSpots = spots\.filter/);
  assert.match(app, /distanceKm\(searchCenter, spot\) <= DETAIL_RADIUS_KM/);
  assert.match(index, /Im 25-km-Umkreis/);
});

test("spot cards and detail view load attributed media safely", async () => {
  const [app, index] = await Promise.all([read("app.js"), read("index.html")]);
  assert.match(app, /function fetchCommonsPhotos/);
  assert.match(app, /commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(app, /upload\.wikimedia\.org/);
  assert.match(app, /data-spot-photo/);
  assert.match(app, /data-detail-gallery/);
  assert.match(app, /map_action=pano/);
  assert.match(index, /connect-src[^\"]*commons\.wikimedia\.org/);
});

test("dynamic community and OSM content is escaped and external URLs are constrained", async () => {
  const [app, index, guide] = await Promise.all([read("app.js"), read("index.html"), read("guide.html")]);
  assert.match(app, /function safeExternalUrl/);
  assert.match(app, /escapeHtml\(spot\.name\)/);
  assert.match(app, /allowedHosts/);
  assert.match(app, /60_000_000/);
  assert.doesNotMatch(app, /visible\.includes\(spot\)/);
  assert.match(app, /\.in\("spot_id", ids\)/);
  assert.match(app, /index \+= 150/);
  for (const html of [index, guide]) {
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /object-src 'none'/);
    assert.match(html, /strict-origin-when-cross-origin/);
  }
});

test("OSM beaches distinguish coast from inland water", async () => {
  const [seed, edge] = await Promise.all([
    read("scripts/seed-germany.py"),
    read("supabase/functions/discover-spots/index.ts")
  ]);
  for (const source of [seed, edge]) {
    assert.match(source, /natural.{0,20}coastline/s);
    assert.match(source, /Badestrand am Binnengewässer/);
    assert.match(source, /Meeresstrand/);
  }
});

test("the supplied hero image exists and has no embedded EXIF marker", async () => {
  const heroFiles = [
    "../assets/hero-w211-columbus.jpg",
    "../assets/hero-w211-columbus-wide-v2.webp",
    "../assets/hero-w211-columbus-mobile-v2.webp"
  ];
  for (const relativePath of heroFiles) {
    const imageUrl = new URL(relativePath, import.meta.url);
    const image = await readFile(imageUrl);
    const info = await stat(imageUrl);
    assert.ok(info.size > 50_000);
    assert.equal(image.includes(Buffer.from("Exif")), false);
    assert.equal(image.includes(Buffer.from("GPS")), false);
  }
  const index = await read("index.html");
  assert.match(index, /hero-w211-columbus-wide-v2\.webp/);
  assert.match(index, /hero-w211-columbus-mobile-v2\.webp/);
});

test("the self-hosted serif includes its open font license", async () => {
  const [styles, font, license] = await Promise.all([
    read("styles.css"),
    readFile(new URL("../assets/fonts/source-serif-4-display-regular.woff2", import.meta.url)),
    read("assets/fonts/OFL-Source-Serif-4.md")
  ]);
  assert.match(styles, /Source Serif 4 Display/);
  assert.ok(font.length > 50_000);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
});

test("repository contains no high-risk frontend secrets", async () => {
  const files = await Promise.all([
    read("supabase-config.js"),
    read("app.js"),
    read("backend.js"),
    read("guide.js")
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /github_pat_|ghp_/);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /BEGIN (?:RSA |EC )?PRIVATE KEY/);
  assert.match(source, /sb_publishable_/);
});
