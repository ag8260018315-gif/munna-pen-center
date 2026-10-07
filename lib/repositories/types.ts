import type {
  Brand,
  CataloguePage,
  CatalogueQuery,
  Category,
  Enquiry,
  NewEnquiry,
  ProductWithCategory,
} from "@/lib/domain/types";

/**
 * Repository interfaces — the seam between the app and its data store.
 *
 * Pages, server actions and (later) the AI sales agent depend ONLY on these
 * interfaces. V1 implements them with static data and a JSONL file. Phase 2
 * adds Prisma implementations; no page or component needs to change.
 */

export interface CatalogueRepository {
  listCategories(): Promise<Category[]>;
  /** Brands to show publicly (those the owner has confirmed). */
  listBrands(): Promise<Brand[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  searchProducts(query?: CatalogueQuery): Promise<CataloguePage>;
  getProductBySlug(slug: string): Promise<ProductWithCategory | null>;
  listRelatedProducts(product: ProductWithCategory, limit?: number): Promise<ProductWithCategory[]>;
  listFeaturedProducts(limit?: number): Promise<ProductWithCategory[]>;
  /** Every active product — for sitemap generation. */
  listAllProducts(): Promise<ProductWithCategory[]>;
}

export interface EnquiryRepository {
  /** Persists a new enquiry and returns it with its generated id, reference and timestamp. */
  create(input: NewEnquiry): Promise<Enquiry>;
  /** Newest first. */
  list(options?: { limit?: number }): Promise<Enquiry[]>;
}

/** Thrown when the enquiry store cannot be written to (read-only disk, DB down, …). */
export class StorageUnavailableError extends Error {
  constructor(message = "Enquiry storage is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageUnavailableError";
  }
}
