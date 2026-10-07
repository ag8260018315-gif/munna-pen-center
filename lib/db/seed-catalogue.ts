import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Loads the OWNER-SUPPLIED catalogue into the database: the 23 categories, the 20 brands, and the five products the
 * owner identified. Nothing else — no SKUs, prices, GST rates, HSN codes, stock, pack sizes, brands on products or
 * customers. Those are entered by the owner in the admin.
 *
 * Safe to run more than once, and never overwrites: each row is created only if its slug is missing
 * (`update: {}`), so anything the owner has since edited stays as they left it.
 */
export interface SeedPlan {
  categories: number;
  brands: number;
  products: number;
}

export function seedPlan(): SeedPlan {
  return { categories: categories.length, brands: brands.length, products: products.length };
}

export async function seedCatalogue(db: PrismaClient): Promise<SeedPlan & { created: SeedPlan }> {
  const created: SeedPlan = { categories: 0, brands: 0, products: 0 };

  for (const category of categories) {
    const before = await db.category.count({ where: { slug: category.slug } });
    await db.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        slug: category.slug,
        name: category.name,
        summary: category.summary,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        sortOrder: category.sortOrder,
      },
    });
    if (before === 0) created.categories++;
  }

  let brandOrder = 0;
  for (const brand of brands) {
    brandOrder += 10;
    const before = await db.brand.count({ where: { slug: brand.slug } });
    await db.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: { slug: brand.slug, name: brand.name, isListedPublicly: brand.listedPublicly, sortOrder: brandOrder },
    });
    if (before === 0) created.brands++;
  }

  for (const product of products) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: product.categoryId }, select: { id: true } });
    const before = await db.product.count({ where: { slug: product.slug } });
    await db.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        categoryId: category.id,
        tags: product.tags,
        isFeatured: product.isFeatured,
        status: "ACTIVE",
      },
    });
    if (before === 0) created.products++;
  }

  return { ...seedPlan(), created };
}
