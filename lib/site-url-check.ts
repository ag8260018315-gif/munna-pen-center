/**
 * Is NEXT_PUBLIC_SITE_URL good enough to build a PRODUCTION site with?
 *
 * Canonical links, sitemap.xml and Open Graph tags are generated from it at build time. An unset value, or the
 * localhost default that `cp .env.example .env.local` puts there, would bake `http://localhost:3000` into every
 * page search engines see.
 *
 * Pure and dependency-free so next.config.ts can import it (it is imported by relative path there).
 */

/**
 * The address as an absolute http(s) URL without a trailing slash, or null when it is not one.
 *
 * `new URL("localhost:3000")` and `new URL("yourdomain.in:8080")` do NOT throw — they parse as a custom scheme
 * ("localhost:", "yourdomain.in:") with an empty hostname — so the protocol and hostname are checked explicitly.
 */
export function normaliseSiteUrl(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null;
  return text.replace(/\/$/, "");
}

/** Describes what is wrong with the value, or returns null when it is fine for a production build. */
export function describeSiteUrlProblem(value: string | undefined): string | null {
  const consequence = "Canonical links, sitemap.xml and Open Graph tags would point at the wrong address.";
  const text = value?.trim() ?? "";
  if (!text) return `NEXT_PUBLIC_SITE_URL is not set. ${consequence}`;

  const url = normaliseSiteUrl(text);
  if (!url) return `NEXT_PUBLIC_SITE_URL ("${text}") is not a full web address such as https://www.yourdomain.in. ${consequence}`;

  const host = new URL(url).hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") {
    return `NEXT_PUBLIC_SITE_URL is "${text}" (a local address). ${consequence}`;
  }
  return null;
}
