/**
 * Is NEXT_PUBLIC_SITE_URL good enough to build a PRODUCTION site with?
 *
 * Canonical links, sitemap.xml and Open Graph tags are generated from it at build time. An unset value, or the
 * localhost default that `cp .env.example .env.local` puts there, would bake `http://localhost:3000` into every
 * page search engines see. Returns a description of the problem, or null when the value is fine.
 *
 * Pure and dependency-free so next.config.ts can import it (it is imported by relative path there).
 */
export function describeSiteUrlProblem(value: string | undefined): string | null {
  const url = value?.trim() ?? "";
  const consequence = "Canonical links, sitemap.xml and Open Graph tags would point at the wrong address.";
  if (!url) return `NEXT_PUBLIC_SITE_URL is not set. ${consequence}`;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return `NEXT_PUBLIC_SITE_URL ("${url}") is not a full URL such as https://www.yourdomain.in. ${consequence}`;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") {
    return `NEXT_PUBLIC_SITE_URL is "${url}" (a local address). ${consequence}`;
  }
  return null;
}
