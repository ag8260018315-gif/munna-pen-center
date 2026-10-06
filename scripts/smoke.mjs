#!/usr/bin/env node
/**
 * Smoke test for a RUNNING site: fetches every public route and checks the basics.
 * `next build` cannot catch errors in routes that only render at request time (search results,
 * the quote page, admin), so run this after building:
 *
 *   npm run build && npm start &         # in one terminal
 *   npm run smoke                        # defaults to http://localhost:3000
 *   npm run smoke -- http://localhost:3100
 *   npm run smoke -- --dev               # against `next dev`, where /admin is open (preview)
 */
const args = process.argv.slice(2);
const dev = args.includes("--dev");
const base = (args.find((arg) => /^https?:\/\//.test(arg)) ?? "http://localhost:3000").replace(/\/$/, "");

const failures = [];
let checked = 0;

function fail(path, message) {
  failures.push(`${path} — ${message}`);
  console.log(`FAIL  ${path}  ${message}`);
}

async function get(path) {
  const res = await fetch(base + path, { redirect: "manual" });
  return { res, body: await res.text() };
}

async function checkPage(path, { status = 200, html = true } = {}) {
  checked++;
  let result;
  try {
    result = await get(path);
  } catch (error) {
    return fail(path, `request failed: ${error.message}`);
  }
  const { res, body } = result;
  if (res.status !== status) return fail(path, `expected HTTP ${status}, got ${res.status}`);
  if (!html) return;

  if (status === 200) {
    const title = /<title>([^<]*)<\/title>/.exec(body)?.[1]?.trim();
    if (!title) fail(path, "missing <title>");
    if (!/<meta name="description" content="[^"]{20,}"/.test(body)) fail(path, "missing meta description");
    const h1s = (body.match(/<h1[\s>]/g) ?? []).length;
    if (h1s !== 1) fail(path, `expected exactly one <h1>, found ${h1s}`);
    if (!/<html[^>]*lang="en-IN"/.test(body)) fail(path, "missing lang=en-IN on <html>");
    for (const img of body.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\balt=/.test(img)) fail(path, `<img> without alt: ${img.slice(0, 80)}`);
    }
  }
  if (/Application error|Internal Server Error|digest=/.test(body) && status === 200) fail(path, "page rendered an error");
}

// Public routes come from the sitemap, so new products/categories are covered automatically.
const sitemap = await get("/sitemap.xml").catch((error) => {
  console.error(`Could not reach ${base}: ${error.message}`);
  process.exit(2);
});
const sitemapPaths = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
if (sitemapPaths.length < 10) fail("/sitemap.xml", `only ${sitemapPaths.length} URLs listed`);

for (const path of sitemapPaths) await checkPage(path);

// Request-time (query-driven) variants.
for (const path of [
  "/products?q=pen",
  "/products?category=pens",
  "/products?q=zzzzqqq", // empty state
  "/products?page=999", // out-of-range page clamps instead of erroring
  "/request-quote?product=ball-pens",
  "/request-quote?product=not-a-real-product",
  "/request-quote?need=A4%20paper",
]) {
  await checkPage(path);
}

for (const path of ["/robots.txt", "/manifest.webmanifest", "/opengraph-image", "/icon.svg"]) await checkPage(path, { html: false });
await checkPage("/does-not-exist", { status: 404 });
// Unknown product / category URLs must be a real HTTP 404 (not a "soft 404") in production.
// `next dev` streams these with 200 while compiling, so only enforce it against a production server.
if (!dev) {
  await checkPage("/products/not-a-real-product", { status: 404 });
  await checkPage("/categories/not-a-category", { status: 404 });
}

// Admin: closed in production, previewable in dev.
await checkPage("/admin", { status: dev ? 200 : 404, html: dev });
await checkPage("/admin/enquiries", { status: dev ? 200 : 404, html: false });
if (!dev) {
  const { body } = await get("/admin");
  if (/Sales pipeline|Admin dashboard/i.test(body)) fail("/admin", "admin UI leaked in production");
}

// robots.txt must keep admin out of search results.
const robots = await get("/robots.txt");
if (!/Disallow: \/admin/.test(robots.body)) fail("/robots.txt", "does not disallow /admin");

console.log(`\n${checked} routes checked, ${failures.length} problem${failures.length === 1 ? "" : "s"}.`);
process.exit(failures.length ? 1 : 0);
