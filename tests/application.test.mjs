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
  assert.match(index, /verantwortungsvollen Übernachten in deinem Dachzelt/);
  assert.match(guide, /id="tip-form"/);
  assert.match(guide, /data-check="roof-locks"/);
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
  const imageUrl = new URL("../assets/hero-w211-columbus.jpg", import.meta.url);
  const image = await readFile(imageUrl);
  const info = await stat(imageUrl);
  assert.ok(info.size > 50_000);
  assert.equal(image.includes(Buffer.from("Exif")), false);
  assert.equal(image.includes(Buffer.from("GPS")), false);
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
