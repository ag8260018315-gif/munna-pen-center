/**
 * Which catalogue the public website reads: the products saved in the admin ("database") or the small built-in starter list
 * ("built-in"). The switch is the CATALOGUE_SOURCE setting in Vercel (see lib/repositories/index.ts). These helpers only
 * INTERPRET that setting so the admin can say plainly what visitors are seeing; they read no secret and never print a value.
 */

export type CatalogueSource = "database" | "built-in" | "invalid";

/** Interprets the raw setting exactly like lib/env.ts does: spaces and one pair of matching quotes are ignored, empty means not set. */
export function catalogueSourceFrom(raw: string | undefined): CatalogueSource {
  let text = (raw ?? "").trim();
  const quote = text[0];
  if (text.length >= 2 && (quote === '"' || quote === "'" || quote === "`") && text.endsWith(quote)) text = text.slice(1, -1).trim();
  if (text === "" || text === "static") return "built-in";
  return text === "database" ? "database" : "invalid";
}

/**
 * Setting NAMES that look like a mistyped CATALOGUE_SOURCE ("CATALOG_SOURCE", "catalogue_source", "CATALOGUE SOURCE"…). A
 * setting with the wrong name is silently ignored by the site, which is the most common reason a product list does not appear.
 * Names only: values are never read here.
 */
export function similarSettingNames(names: readonly string[]): string[] {
  return names.filter((name) => name !== "CATALOGUE_SOURCE" && name.toUpperCase().replace(/[^A-Z]/g, "").includes("CATALOG")).sort();
}
