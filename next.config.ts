import type { NextConfig } from "next";
import { describeSiteUrlProblem } from "./lib/site-url-check";

const isProd = process.env.NODE_ENV === "production";

// NEXT_PUBLIC_* values are inlined at BUILD time. Without the real domain, canonical URLs, the sitemap and
// Open Graph tags would all point at localhost — including when `cp .env.example .env.local` set the
// localhost default, so that case is flagged too.
const siteUrlProblem = isProd && process.env.npm_lifecycle_event === "build" ? describeSiteUrlProblem(process.env.NEXT_PUBLIC_SITE_URL) : null;
if (siteUrlProblem) {
  console.warn(`\n⚠  ${siteUrlProblem}\n   Set it to your public domain (e.g. https://www.yourdomain.in) before building for production.\n`);
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Only meaningful over HTTPS; browsers ignore it on http://localhost.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The default cap is 1 MB, ~50x the largest legitimate enquiry (≈60 KB even with 50 listed products
    // and every field full of multi-byte text). A small cap blunts oversized-POST abuse.
    serverActions: { bodySizeLimit: "128kb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Product photos are served from /public. If images move to a CDN or object
    // storage later, allow that host here with `remotePatterns`.
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Admin pages must never be indexed or cached by shared caches.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
