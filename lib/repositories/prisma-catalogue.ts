import "server-only";
import type { Brand, CataloguePage, CatalogueQuery, Category, Product, ProductWithCategory } from "@/lib/domain/types";
import { getDb } from "@/lib/db/client";
import { StaticCatalogueRepository } from "@/lib/repositories/static-catalogue";
import type { CatalogueRepository } from "@/lib/repositories/types";

/**
 * Catalogue read from the database (Supabase PostgreSQL).
 *
 * SECURITY: this is the PUBLIC catalogue. Every query below uses an explicit `select` of public columns only — never
 * `findMany()` without one — so purchase / wholesale / retail prices, SKU, stock, HSN and GST can not reach a page,
 * a server-rendered payload or a log line by accident. A test fails if a price column name appears in a query here.
 *
 * Searching, ranking and paging reuse StaticCatalogueRepository's in-memory logic on the (small) set of active
 * products, so both stores behave identically. A short snapshot cache keeps bots from hitting the database per request.
 */

const SNAPSHOT_TTL_MS = 30_000;

/**
 * Bumped by the admin whenever it changes the catalogue, so the instance that handled the change shows it at once.
 * (Other server instances pick it up within SNAPSHOT_TTL_MS.)
 */
let generation = 0;
export function invalidateCatalogueSnapshot() {
  generation++;
}

interface Snapshot {
  at: number;
  generation: number;
  repo: StaticCatalogueRepository;
}

export class PrismaCatalogueRepository implements CatalogueRepository {
  private snapshot: Promise<Snapshot> | undefined;

  private async load(): Promise<Snapshot> {
    const startedAtGeneration = generation; // a change made while loading must not be cached as current
    const db = getDb();
    const [categories, brands, products] = await Promise.all([
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true, summary: true, description: true, seoTitle: true, seoDescription: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.brand.findMany({
        where: { isActive: true, isListedPublicly: true },
        select: { id: true, slug: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.product.findMany({
        where: { status: "ACTIVE", category: { isActive: true } },
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescription: true,
          description: true,
          categoryId: true,
          brandId: true,
          imageUrl: true,
          imageAlt: true,
          packSize: true,
          tags: true,
          isFeatured: true,
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    const domainCategories: Category[] = categories.map((c) => {
      const summary = c.summary ?? "";
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        summary,
        description: c.description ?? summary,
        seoTitle: c.seoTitle ?? `Wholesale ${c.name} Supplier`,
        seoDescription: c.seoDescription ?? `${summary} Wholesale supply from Dhanbad, Jharkhand across India. Request a quote for your quantity.`.trim(),
        sortOrder: c.sortOrder,
      };
    });
    const domainBrands: Brand[] = brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, listedPublicly: true }));
    const domainProducts: Product[] = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription ?? p.description ?? "",
      categoryId: p.categoryId,
      brandId: p.brandId ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
      imageAlt: p.imageAlt ?? undefined,
      packInfo: p.packSize ?? undefined,
      tags: p.tags,
      status: "ACTIVE",
      isFeatured: p.isFeatured,
    }));

    return { at: Date.now(), generation: startedAtGeneration, repo: new StaticCatalogueRepository(domainCategories, domainProducts, domainBrands) };
  }

  private async current(): Promise<StaticCatalogueRepository> {
    if (this.snapshot) {
      const existing = await this.snapshot.catch(() => undefined);
      if (existing && existing.generation === generation && Date.now() - existing.at < SNAPSHOT_TTL_MS) return existing.repo;
    }
    const fresh = this.load();
    this.snapshot = fresh;
    try {
      return (await fresh).repo;
    } catch (error) {
      this.snapshot = undefined; // do not cache a failure
      throw error;
    }
  }

  async listCategories(): Promise<Category[]> {
    return (await this.current()).listCategories();
  }
  async listBrands(): Promise<Brand[]> {
    return (await this.current()).listBrands();
  }
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return (await this.current()).getCategoryBySlug(slug);
  }
  async searchProducts(query?: CatalogueQuery): Promise<CataloguePage> {
    return (await this.current()).searchProducts(query);
  }
  async getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
    return (await this.current()).getProductBySlug(slug);
  }
  async listRelatedProducts(product: ProductWithCategory, limit?: number): Promise<ProductWithCategory[]> {
    return (await this.current()).listRelatedProducts(product, limit);
  }
  async listFeaturedProducts(limit?: number): Promise<ProductWithCategory[]> {
    return (await this.current()).listFeaturedProducts(limit);
  }
  async listAllProducts(): Promise<ProductWithCategory[]> {
    return (await this.current()).listAllProducts();
  }
}
