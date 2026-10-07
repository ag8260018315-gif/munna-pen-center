import { brands as brandData } from "@/data/brands";
import { categories as categoryData } from "@/data/categories";
import { products as productData } from "@/data/products";
import type {
  Brand,
  CataloguePage,
  CatalogueQuery,
  Category,
  Product,
  ProductWithCategory,
} from "@/lib/domain/types";
import type { CatalogueRepository } from "@/lib/repositories/types";

export const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

function normalise(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Scores how well a product matches the search tokens. Every token must match
 * somewhere (AND search); name matches rank above description/tag matches.
 * Returns 0 when the product does not match.
 */
export function scoreProduct(product: ProductWithCategory, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const name = normalise(product.name);
  const category = normalise(product.category.name);
  const description = normalise(product.shortDescription);
  const tags = normalise(product.tags.join(" "));

  let score = 0;
  for (const token of tokens) {
    if (name.includes(token)) score += 10;
    else if (tags.includes(token)) score += 5;
    else if (category.includes(token)) score += 3;
    else if (description.includes(token)) score += 2;
    else return 0;
  }
  return score;
}

/**
 * V1 catalogue backed by static TypeScript data. Same contract the Prisma
 * implementation will satisfy later.
 */
export class StaticCatalogueRepository implements CatalogueRepository {
  private readonly categories: Category[];
  private readonly brands: Brand[];
  private readonly products: ProductWithCategory[];

  constructor(categories: Category[] = categoryData, products: Product[] = productData, brands: Brand[] = brandData) {
    this.brands = brands.filter((brand) => brand.listedPublicly);
    this.categories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const byId = new Map(this.categories.map((category) => [category.id, category]));
    this.products = products
      .filter((product) => product.status === "ACTIVE")
      .flatMap((product) => {
        const category = byId.get(product.categoryId);
        return category ? [{ ...product, category }] : [];
      });
  }

  async listCategories() {
    return this.categories;
  }

  async listBrands() {
    return this.brands;
  }

  async getCategoryBySlug(slug: string) {
    return this.categories.find((category) => category.slug === slug) ?? null;
  }

  async searchProducts({ query, categorySlug, page = 1, pageSize = DEFAULT_PAGE_SIZE }: CatalogueQuery = {}): Promise<CataloguePage> {
    const size = Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
    const tokens = normalise(query ?? "").split(" ").filter(Boolean);

    const matches = this.products
      .filter((product) => !categorySlug || product.category.slug === categorySlug)
      .map((product) => ({ product, score: scoreProduct(product, tokens) }))
      .filter(({ score }) => score > 0)
      // Best match first; stable by catalogue order (category, then name) otherwise.
      .sort((a, b) => b.score - a.score)
      .map(({ product }) => product);

    const total = matches.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
    const start = (safePage - 1) * size;

    return { items: matches.slice(start, start + size), total, page: safePage, pageSize: size, totalPages };
  }

  async getProductBySlug(slug: string) {
    return this.products.find((product) => product.slug === slug) ?? null;
  }

  async listRelatedProducts(product: ProductWithCategory, limit = 4) {
    return this.products
      .filter((candidate) => candidate.category.id === product.category.id && candidate.id !== product.id)
      .slice(0, limit);
  }

  async listFeaturedProducts(limit = 8) {
    return this.products.filter((product) => product.isFeatured).slice(0, limit);
  }

  async listAllProducts() {
    return this.products;
  }
}
