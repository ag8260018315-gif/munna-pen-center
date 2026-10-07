import type { Brand } from "@/lib/domain/types";

/**
 * Brands Munna Pen Center can supply, as listed by the owner. This is a BRAND list, not a product list:
 * no product, SKU, price or stock is attached to any of them. Names are shown as plain text only —
 * no logos, and no claim of being an authorised dealer or distributor.
 *
 * "Cello Tape" and "Adhesive Tape" are PRODUCT TYPES (categories), not brands, so they are deliberately not here.
 * Brands and categories are separate lists and separate database tables.
 */
const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const brand = (name: string): Brand => ({ id: slugify(name), slug: slugify(name), name, listedPublicly: true });

export const brands: Brand[] = [
  brand("DOMS"),
  brand("Natraj"),
  brand("Pidilite"),
  brand("Linc"),
  brand("Flair"),
  brand("Cello"),
  brand("Faber-Castell"),
  brand("Luxor"),
  brand("Kangaro"),
  brand("STP"),
  brand("Montex"),
  brand("Artline"),
  brand("Casio"),
  brand("Shanti File"),
  brand("Supra"),
  brand("Goldex"),
  brand("Reynolds"),
  brand("Pierre Cardin"),
  brand("Polo Tape"),
  brand("Kores"),
];
