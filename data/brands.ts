import type { Brand } from "@/lib/domain/types";

/**
 * Brands Munna Pen Center can supply, as listed by the owner. This is a BRAND list, not a product list:
 * no product, SKU, price or stock is attached to any of them. Names are shown as plain text only —
 * no logos, and no claim of being an authorised dealer or distributor.
 *
 * "Cello Tape" and "Adhesive Tape" were on the owner's brand list but are product types (they are also
 * categories), so they are kept here for the database but not shown publicly until the owner confirms them.
 */
const brand = (name: string, listedPublicly = true): Brand => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  name,
  listedPublicly,
});

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
  brand("Cello Tape", false),
  brand("Polo Tape"),
  brand("Adhesive Tape", false),
  brand("Kores"),
];
