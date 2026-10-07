/**
 * Domain types.
 *
 * These mirror prisma/schema.prisma by hand so V1 has no database dependency.
 * When the database is connected, swap these for the generated Prisma types
 * (or keep them as the app-facing shape and map in the repository layer).
 */

export type ProductStatus = "ACTIVE" | "DRAFT" | "INACTIVE";

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** Short intro shown on category cards. */
  summary: string;
  /** Longer copy shown at the top of the category page. */
  description: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
}

/** A brand the business can supply. A brand is NOT a product: nothing is priced or stocked at brand level. */
export interface Brand {
  id: string;
  slug: string;
  name: string;
  /** False = kept in the data but not shown on the public site (e.g. awaiting the owner's confirmation). */
  listedPublicly: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  categoryId: string;
  /** Brand, once the owner has linked one. Null/absent = no brand stated. */
  brandId?: string;
  /** Public path or URL. When absent the UI renders a neutral category placeholder. */
  imageUrl?: string;
  imageAlt?: string;
  /** Pack / unit information, e.g. "Box of 10 · Carton of 100". Leave empty until confirmed. */
  packInfo?: string;
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
}

export type ProductWithCategory = Product & { category: Category };

export interface CatalogueQuery {
  query?: string;
  categorySlug?: string;
  page?: number;
  pageSize?: number;
}

export interface CataloguePage {
  items: ProductWithCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------- Enquiries */

export type EnquirySource =
  | "BULK_ORDER_FORM"
  | "QUOTE_FORM"
  | "CONTACT_FORM"
  | "WHATSAPP"
  | "PHONE"
  | "AI_AGENT";

export type EnquiryStatus = "NEW" | "IN_REVIEW" | "QUOTED" | "WON" | "LOST" | "SPAM";

export interface EnquiryItem {
  /** Null when the customer typed a product that is not in the catalogue. */
  productId: string | null;
  productName: string;
  quantityNote?: string;
}

export interface Enquiry {
  id: string;
  /** Human-friendly reference shown to the customer, e.g. ENQ-20261006-K4PZ. */
  reference: string;
  source: EnquirySource;
  status: EnquiryStatus;
  name: string;
  organization?: string;
  /** E.164, e.g. +917979025166 */
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  productsRequired: string;
  approximateQuantity?: string;
  additionalRequirements?: string;
  items: EnquiryItem[];
  createdAt: string;
}

export type NewEnquiry = Omit<Enquiry, "id" | "reference" | "status" | "createdAt">;
