import type { Product } from "@/lib/domain/types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CATALOGUE — ONLY WHAT THE OWNER HAS IDENTIFIED
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner has identified five products so far. There are deliberately NO other products, no brands
 * attached, and no SKUs, prices, GST rates, HSN codes, stock or pack sizes: those are entered by the owner
 * in the admin once the database is connected (the `Product` table has fields for all of them).
 *
 * To add a product image, drop a file in /public/images/products/ and set
 * `imageUrl: "/images/products/<file>.jpg"` and `imageAlt: "…"`. Products without an image render a neutral
 * category placeholder.
 */

type ProductInput = {
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  packInfo?: string;
  imageUrl?: string;
  imageAlt?: string;
  tags?: string[];
  isFeatured?: boolean;
};

const product = (input: ProductInput): Product => ({
  id: input.slug,
  slug: input.slug,
  name: input.name,
  categoryId: input.categoryId,
  shortDescription: input.shortDescription,
  packInfo: input.packInfo,
  imageUrl: input.imageUrl,
  imageAlt: input.imageAlt,
  tags: input.tags ?? [],
  status: "ACTIVE",
  isFeatured: input.isFeatured ?? false,
});

export const products: Product[] = [
  product({
    slug: "glue-guns",
    name: "Glue Guns",
    categoryId: "glue-guns",
    shortDescription: "Glue guns for craft, packaging and repair work.",
    tags: ["glue gun", "hot melt", "craft"],
    isFeatured: true,
  }),
  product({
    slug: "glue-sticks",
    name: "Glue Sticks & Glue Gun Sticks",
    categoryId: "glue-sticks",
    shortDescription: "Glue sticks and refill sticks for glue guns.",
    tags: ["glue stick", "glue gun stick", "refill", "hot melt"],
    isFeatured: true,
  }),
  product({
    slug: "cello-tape",
    name: "Cello Tape",
    categoryId: "cello-tape",
    shortDescription: "Cello tape for office, school and packing use.",
    tags: ["tape", "sellotape", "transparent tape"],
    isFeatured: true,
  }),
  product({
    slug: "adhesive-tape",
    name: "Adhesive Tape",
    categoryId: "adhesive-tape",
    shortDescription: "Adhesive tapes for packing and general use.",
    tags: ["tape", "packing tape", "sticky tape"],
    isFeatured: true,
  }),
  product({
    slug: "calculators",
    name: "Calculators",
    categoryId: "calculators",
    shortDescription: "Calculators for school, office and engineering use.",
    tags: ["calculator", "scientific", "desktop"],
    isFeatured: true,
  }),
];
