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

const PRODUCT_LINK = /href="\/products\/[a-z0-9-]+"/;

/**
 * `expect`: regexes the page body must match. A page that merely returns 200 can still be empty — a broken
 * category filter once produced ten category pages with no products in them and every check stayed green.
 */
async function checkPage(path, { status = 200, html = true, expect = [] } = {}) {
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

  for (const pattern of expect) {
    if (!pattern.test(body)) fail(path, `expected content missing: ${pattern}`);
  }
  if (status === 200) {
    const decode = (text) => text.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
    const title = /<title>([^<]*)<\/title>/.exec(body)?.[1]?.trim();
    if (!title) fail(path, "missing <title>");
    else {
      const shown = decode(title);
      if (shown.length > 60) fail(path, `title is ${shown.length} characters (search results cut at ~60): "${shown}"`);
      if ((shown.match(/munna pen center/gi) ?? []).length > 1) fail(path, `brand name repeated in title: "${shown}"`);
    }
    const description = /<meta name="description" content="([^"]*)"/.exec(body)?.[1];
    if (description && decode(description).length > 160) fail(path, `meta description is ${decode(description).length} characters (max 160)`);
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

for (const path of sitemapPaths) {
  // Category landing pages and product-list pages must actually list products.
  await checkPage(path, { expect: path.startsWith("/categories/") ? [PRODUCT_LINK] : [] });
}

// Categories with no products listed yet are not in the sitemap (they are noindex), but the pages must still work and
// say so honestly instead of rendering an empty grid.
const home = await get("/");
const linkedCategories = [...new Set([...home.body.matchAll(/href="(\/categories\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
if (linkedCategories.length < 8) fail("/", `only ${linkedCategories.length} category links on the home page`);
for (const path of linkedCategories.filter((link) => !sitemapPaths.includes(link))) {
  await checkPage(path, { expect: [/tell us what you need/i, /noindex/] });
}

// Request-time (query-driven) variants.
for (const [path, expect] of [
  ["/products?q=tape", [PRODUCT_LINK]],
  ["/products?category=glue-guns", [PRODUCT_LINK]],
  ["/products?q=zzzzqqq", [/No products match/]], // empty state
  ["/products?page=999", [PRODUCT_LINK]], // out-of-range page clamps instead of erroring
  ["/request-quote?product=glue-guns", []],
  ["/request-quote?product=not-a-real-product", []],
  ["/request-quote?need=A4%20paper", [/A4 paper/]],
]) {
  await checkPage(path, { expect });
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
