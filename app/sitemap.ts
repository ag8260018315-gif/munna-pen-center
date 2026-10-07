import type { MetadataRoute } from "next";
import { getCatalogue } from "@/lib/repositories";
import { absoluteUrl } from "@/lib/seo";

/** Re-generate at most every 5 minutes, so products the owner edits in the admin appear without a redeploy. */
export const revalidate = 300;

/** Lists every public, indexable URL. Products and categories come from the catalogue repository, so new ones appear automatically. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = getCatalogue();
  const [categories, products] = await Promise.all([catalogue.listCategories(), catalogue.listAllProducts()]);

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/bulk-orders"), changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/request-quote"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.7 },
    // Categories with nothing listed yet are noindex, so they stay out of the sitemap too.
    ...categories.filter((category) => products.some((product) => product.category.id === category.id)).map((category) => ({ url: absoluteUrl(`/categories/${category.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
