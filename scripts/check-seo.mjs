import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// Inspect the actual export, rather than assuming source settings reach the HTML.
const directory = resolve(process.argv[2] || "out");
const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://klinikavcifrah.ru");
if (origin.hostname === "www.klinikavcifrah.ru") origin.hostname = "klinikavcifrah.ru";
const expectedOrigin = origin.origin;
const decode = (value) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
const read = (path) => readFile(join(directory, path), "utf8");
const sitemap = await read("sitemap.xml");
assert(!/localhost|127\.0\.0\.1|\[::1\]/i.test(sitemap), "sitemap includes a local origin");
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]));
assert(locations.length > 0, "sitemap is empty");
assert.equal(new Set(locations).size, locations.length, "duplicate sitemap locations");

const report = [];
for (const location of locations) {
  const url = new URL(location);
  assert.equal(url.origin, expectedOrigin, `sitemap origin: ${location}`);
  const path = url.pathname;
  const html = await read(path === "/" ? "index.html" : `${path.slice(1)}.html`);
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attrs(match[0]));
  const canonicals = links.filter((link) => link.rel === "canonical");
  assert.equal(canonicals.length, 1, `canonical count: ${path}`);
  // Next serializes a root canonical without a trailing slash. Both resolve to /.
  assert.equal(new URL(canonicals[0].href).href, url.href, `canonical disagrees with sitemap: ${path}`);
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => attrs(match[0]));
  const meta = (key) => tags.find((tag) => (tag.property || tag.name) === key)?.content;
  assert.equal(new URL(meta("og:url")).href, url.href, `og:url: ${path}`);
  for (const key of ["og:image", "twitter:image"]) {
    const image = new URL(meta(key));
    assert.equal(image.origin, expectedOrigin, `${key}: ${path}`);
    assert.equal(image.pathname, "/opengraph-image", `${key} path: ${path}`);
  }
  assert.equal(meta("twitter:card"), "summary_large_image", `Twitter card: ${path}`);
  assert(meta("description"), `missing description: ${path}`);
  assert(!/\bnoindex\b/i.test(meta("robots") || ""), `unexpected noindex: ${path}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `H1 count: ${path}`);
  const structured = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
  assert(structured.length > 0, `missing JSON-LD: ${path}`);
  for (const [, json] of structured) {
    JSON.parse(json);
    assert(!/localhost|127\.0\.0\.1|\[::1\]/i.test(json), `local URL in JSON-LD: ${path}`);
  }
  for (const [, tag] of html.matchAll(/(<form\b[^>]*>)/g)) {
    const form = attrs(tag);
    assert.equal(form.method?.toLowerCase(), "post", `unsafe native form method: ${path}`);
    assert.equal(form.action, "/api/leads", `unsafe native form action: ${path}`);
  }
  report.push({ path, canonical: location, jsonLdBlocks: structured.length });
}

const robots = await read("robots.txt");
assert(robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`), "incorrect robots sitemap");
assert(!/^Disallow:\s*\/\s*$/m.test(robots), "robots blocks the whole site");
assert(!/localhost|127\.0\.0\.1|\[::1\]/i.test(robots), "local URL in robots");
const image = await readFile(join(directory, "opengraph-image"));
assert.equal(image.subarray(1, 4).toString(), "PNG", "OG image is not PNG");
assert.equal(image.readUInt32BE(16), 1200, "OG image width");
assert.equal(image.readUInt32BE(20), 630, "OG image height");
await read("404.html");
console.table(report);
console.log(`SEO export checks passed for ${report.length} pages, robots, sitemap, 404 and the 1200×630 OG image.`);
