import { DESCRIPTION_MAX } from "@/content/seo";
import type { ProductWithCategory } from "@/lib/domain/types";

/** <title> for a product page (the layout appends " | Munna Pen Center"). */
export function productSeoTitle(product: Pick<ProductWithCategory, "name">): string {
  return `${product.name} – Wholesale`;
}

/**
 * Meta description for a product page: the product's own one-liner plus a short call to action, using the
 * longest wording that still fits the 160-character search-result limit.
 */
export function productSeoDescription(product: Pick<ProductWithCategory, "shortDescription">): string {
  const base = product.shortDescription.trim();
  const candidates = [
    `${base} Wholesale supply from Munna Pen Center, Dhanbad, across India. Request a quote.`,
    `${base} Wholesale supply from Dhanbad, across India. Request a quote.`,
    `${base} Request a wholesale quote.`,
    base,
  ];
  return candidates.find((text) => text.length <= DESCRIPTION_MAX) ?? base;
}
