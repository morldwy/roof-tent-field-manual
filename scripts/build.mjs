import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const files = [
  "index.html",
  "guide.html",
  "styles.css",
  "app.js",
  "backend.js",
  "guide.js",
  "supabase-config.js"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
await writeFile(resolve(output, ".nojekyll"), "");

for (const page of ["index.html", "guide.html"]) {
  const html = await readFile(resolve(output, page), "utf8");
  if (!html.includes("Roof Tent Manual")) {
    throw new Error(`${page} does not contain the product identity`);
  }
}

console.log(`Built ${files.length + 2} static entries in dist/`);
