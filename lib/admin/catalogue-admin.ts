import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { invalidateCatalogueSnapshot } from "@/lib/repositories/prisma-catalogue";
import {
  brandSchema,
  categorySchema,
  fieldErrors,
  productSchema,
  slugify,
  stockSchema,
  type BrandInput,
  type CategoryInput,
  type ProductInput,
} from "@/lib/validation/admin-catalogue";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Admin data functions for the catalogue. EVERY exported function calls `requireAdmin()` first (a test enforces this):
 * a server action can be POSTed directly, so the page-level check alone is never enough.
 *
 * Nothing is defaulted: a blank box is stored as NULL ("not entered"), never 0. Prices, GST and HSN may be changed by the
 * OWNER only — staff can add and edit products and update stock.
 */

export type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };

const PAGE_SIZE = 25;

// ───────────────────────────── helpers ─────────────────────────────

function uniqueTarget(error: unknown): string | null {
  // With the pg driver adapter the violated index is named inside `meta` (e.g. "Brand_slug_key"), not in `meta.target`.
  const e = error as { code?: string; meta?: unknown } | null;
  return e?.code === "P2002" ? JSON.stringify(e.meta ?? "").toLowerCase() : null;
}

/** `autoSlug`: the slug was made from the name, so a clash on it is really a clash on the name. */
function conflictResult(error: unknown, labels: Record<string, [field: string, message: string]>, autoSlug = false): Result | null {
  const target = uniqueTarget(error);
  if (target === null) return null;
  for (const [needle, [field, message]] of Object.entries(labels)) {
    if (!target.includes(needle)) continue;
    if (autoSlug && field === "slug") {
      const text = "Another one with this name (or a very similar one) already exists";
      return { ok: false, message: text, fieldErrors: { name: text } };
    }
    return { ok: false, message, fieldErrors: { [field]: message } };
  }
  return { ok: false, message: "That value is already used." };
}

const failed = (error: unknown, what: string): Result => {
  console.error(`[admin] ${what} failed:`, error instanceof Error ? error.message : "unknown");
  return { ok: false, message: "Could not save. Please try again." };
};

/** The public website must pick up changes at once. */
const refreshSite = () => {
  invalidateCatalogueSnapshot();
  revalidatePath("/", "layout");
};

const PRICE_FIELDS = ["purchasePrice", "wholesalePrice", "retailPrice", "gstRatePercent", "hsnCode"] as const;

// ───────────────────────────── products ─────────────────────────────

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  categoryName: string;
  brandName: string | null;
  stockQuantity: number | null;
  wholesalePrice: string | null;
  updatedAt: Date;
}

export async function listProducts(params: { q?: string; status?: string; categoryId?: string; page?: number }) {
  await requireAdmin();
  const where: Prisma.ProductWhereInput = {};
  const q = params.q?.trim().slice(0, 80);
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }];
  if (params.status === "DRAFT" || params.status === "ACTIVE" || params.status === "INACTIVE") where.status = params.status;
  if (params.categoryId) where.categoryId = params.categoryId;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const db = getDb();
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    }),
  ]);
  const items: ProductRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    status: p.status,
    categoryName: p.category.name,
    brandName: p.brand?.name ?? null,
    stockQuantity: p.stockQuantity,
    wholesalePrice: p.wholesalePrice?.toString() ?? null,
    updatedAt: p.updatedAt,
  }));
  return { items, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getProductForEdit(id: string) {
  await requireAdmin();
  const p = await getDb().product.findUnique({ where: { id } });
  if (!p) return null;
  return {
    ...p,
    purchasePrice: p.purchasePrice?.toString() ?? null,
    wholesalePrice: p.wholesalePrice?.toString() ?? null,
    retailPrice: p.retailPrice?.toString() ?? null,
    gstRatePercent: p.gstRatePercent?.toString() ?? null,
  };
}

async function referencesExist(input: ProductInput): Promise<Result | null> {
  const db = getDb();
  const category = await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
  if (!category) return { ok: false, message: "Choose a category.", fieldErrors: { categoryId: "Choose a category" } };
  if (input.brandId) {
    const brand = await db.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
    if (!brand) return { ok: false, message: "That brand no longer exists.", fieldErrors: { brandId: "Choose a brand from the list" } };
  }
  return null;
}

const PRODUCT_CONFLICTS: Record<string, [string, string]> = { slug: ["slug", "Another product already uses this web address"], sku: ["sku", "Another product already has this SKU"] };

export async function createProduct(raw: Record<string, string>): Promise<Result> {
  const session = await requireAdmin();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (session.role !== "OWNER" && PRICE_FIELDS.some((f) => input[f] !== null)) {
    return { ok: false, message: "Only the owner can enter prices, GST and HSN.", fieldErrors: {} };
  }
  const bad = await referencesExist(input);
  if (bad) return bad;
  try {
    const product = await getDb().product.create({ data: { ...input, slug: input.slug ?? (slugify(input.name) || "product") } });
    refreshSite();
    return { ok: true, id: product.id };
  } catch (error) {
    return conflictResult(error, PRODUCT_CONFLICTS, !input.slug) ?? failed(error, "createProduct");
  }
}

export async function updateProduct(id: string, raw: Record<string, string>): Promise<Result> {
  const session = await requireAdmin();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const db = getDb();
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "That product no longer exists." };

  if (session.role !== "OWNER") {
    // A staff form has these boxes disabled, so the browser does not send them: keep what is stored. If they ARE sent
    // (someone POSTing directly) and differ, refuse below.
    const keep = <K extends (typeof PRICE_FIELDS)[number]>(key: K) => {
      if (!(key in raw)) (input as Record<string, unknown>)[key] = existing[key]?.toString() ?? null;
    };
    PRICE_FIELDS.forEach(keep);
    const sameNumber = (a: string | null, b: string | null) => (a === null || b === null ? a === b : Number(a) === Number(b));
    const changed =
      input.hsnCode !== existing.hsnCode ||
      !sameNumber(input.purchasePrice, existing.purchasePrice?.toString() ?? null) ||
      !sameNumber(input.wholesalePrice, existing.wholesalePrice?.toString() ?? null) ||
      !sameNumber(input.retailPrice, existing.retailPrice?.toString() ?? null) ||
      !sameNumber(input.gstRatePercent, existing.gstRatePercent?.toString() ?? null);
    if (changed) return { ok: false, message: "Only the owner can change prices, GST and HSN.", fieldErrors: {} };
  }
  const bad = await referencesExist(input);
  if (bad) return bad;
  try {
    await db.product.update({ where: { id }, data: { ...input, slug: input.slug ?? existing.slug } });
    refreshSite();
    return { ok: true, id };
  } catch (error) {
    return conflictResult(error, PRODUCT_CONFLICTS) ?? failed(error, "updateProduct");
  }
}

/** "Delete" is deactivation: the row stays, so quotations and invoices that mention it keep working. */
export async function setProductStatus(id: string, status: "DRAFT" | "ACTIVE" | "INACTIVE"): Promise<Result> {
  await requireAdmin();
  if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) return { ok: false, message: "Unknown status." };
  try {
    const { count } = await getDb().product.updateMany({ where: { id }, data: { status } });
    if (!count) return { ok: false, message: "That product no longer exists." };
    refreshSite();
    return { ok: true, id };
  } catch (error) {
    return failed(error, "setProductStatus");
  }
}

/** Quick stock edit. Blank = stock not tracked (NULL); 0 = tracked and out of stock. */
export async function updateStock(id: string, raw: Record<string, string>): Promise<Result> {
  await requireAdmin();
  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Enter a whole number, or leave blank if you do not track stock.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const { count } = await getDb().product.updateMany({ where: { id }, data: { stockQuantity: parsed.data.stockQuantity } });
    if (!count) return { ok: false, message: "That product no longer exists." };
    return { ok: true, id };
  } catch (error) {
    return failed(error, "updateStock");
  }
}

export async function listInventory(params: { q?: string; page?: number }) {
  await requireAdmin();
  return listProducts({ q: params.q, page: params.page });
}

// ───────────────────────────── brands ─────────────────────────────

const BRAND_CONFLICTS: Record<string, [string, string]> = { slug: ["slug", "Another brand already uses this web address"], name: ["name", "A brand with this name already exists"] };

export async function listBrands() {
  await requireAdmin();
  return getDb().brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
}

export async function getBrand(id: string) {
  await requireAdmin();
  return getDb().brand.findUnique({ where: { id } });
}

export async function saveBrand(id: string | null, raw: Record<string, string>): Promise<Result> {
  await requireAdmin();
  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data: BrandInput = parsed.data;
  try {
    const db = getDb();
    const slug = data.slug ?? (slugify(data.name) || "brand");
    const brand = id ? await db.brand.update({ where: { id }, data: { ...data, slug: data.slug ?? undefined } }) : await db.brand.create({ data: { ...data, slug } });
    refreshSite();
    return { ok: true, id: brand.id };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") return { ok: false, message: "That brand no longer exists." };
    return conflictResult(error, BRAND_CONFLICTS, !data.slug) ?? failed(error, "saveBrand");
  }
}

// ───────────────────────────── categories ─────────────────────────────

const CATEGORY_CONFLICTS: Record<string, [string, string]> = { slug: ["slug", "Another category already uses this web address"] };

export async function listCategories() {
  await requireAdmin();
  return getDb().category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
}

export async function getCategory(id: string) {
  await requireAdmin();
  return getDb().category.findUnique({ where: { id } });
}

export async function saveCategory(id: string | null, raw: Record<string, string>): Promise<Result> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data: CategoryInput = parsed.data;
  try {
    const db = getDb();
    const slug = data.slug ?? (slugify(data.name) || "category");
    const category = id ? await db.category.update({ where: { id }, data: { ...data, slug: data.slug ?? undefined } }) : await db.category.create({ data: { ...data, slug } });
    refreshSite();
    return { ok: true, id: category.id };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") return { ok: false, message: "That category no longer exists." };
    return conflictResult(error, CATEGORY_CONFLICTS, !data.slug) ?? failed(error, "saveCategory");
  }
}

// ───────────────────────────── enquiries (read-only) ─────────────────────────────

export async function listEnquiries(params: { page?: number; status?: string }) {
  await requireAdmin();
  const where: Prisma.EnquiryWhereInput = {};
  if (["NEW", "IN_REVIEW", "QUOTED", "WON", "LOST", "SPAM"].includes(params.status ?? "")) where.status = params.status as never;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const db = getDb();
  const [total, items] = await Promise.all([
    db.enquiry.count({ where }),
    db.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { lead: { select: { name: true, organizationName: true, phone: true } } } }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getEnquiry(id: string) {
  await requireAdmin();
  return getDb().enquiry.findUnique({ where: { id }, include: { lead: true, items: true } });
}

// ───────────────────────────── dashboard ─────────────────────────────

export async function getDashboardCounts() {
  await requireAdmin();
  const db = getDb();
  const [newEnquiries, enquiries, activeProducts, draftProducts, outOfStock, brands, categories] = await Promise.all([
    db.enquiry.count({ where: { status: "NEW" } }),
    db.enquiry.count(),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "DRAFT" } }),
    db.product.count({ where: { stockQuantity: 0 } }),
    db.brand.count({ where: { isActive: true } }),
    db.category.count({ where: { isActive: true } }),
  ]);
  return { newEnquiries, enquiries, activeProducts, draftProducts, outOfStock, brands, categories };
}

// ───────────────────────────── form option lists ─────────────────────────────

export async function getCatalogueOptions() {
  await requireAdmin();
  const db = getDb();
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
    db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
  ]);
  return { categories, brands };
}
