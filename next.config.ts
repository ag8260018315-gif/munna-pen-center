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

/**
 * Product pictures are stored in Supabase Storage (a public bucket) and shown through next/image. Only THAT project's
 * public-object path is allowed, read from SUPABASE_URL at build time (quotes/spaces pasted into a dashboard are
 * tolerated; anything unusable simply allows nothing).
 */
function supabaseImagePatterns() {
  const raw = (process.env.SUPABASE_URL ?? "").trim().replace(/^(["'`])(.*)\1$/, "$2").trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return [];
    return [{ protocol: "https" as const, hostname: url.hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
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
    // Product photos uploaded in the admin live in Supabase Storage; older ones may sit in /public.
    remotePatterns: supabaseImagePatterns(),
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
