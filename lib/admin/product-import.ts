import "server-only";
import { revalidatePath } from "next/cache";
import { parseCsv } from "@/lib/csv";
import { requireAdmin } from "@/lib/auth/guard";
import type { AdminSession } from "@/lib/auth/guard-types";
import { getDb } from "@/lib/db/client";
import { invalidateCatalogueSnapshot } from "@/lib/repositories/prisma-catalogue";
import { productSchema, slugify, type ProductInput } from "@/lib/validation/admin-catalogue";

/**
 * Adding many products at once from a spreadsheet saved as CSV.
 *
 *  • ALL-OR-NOTHING: if any row has a problem, nothing is imported and every problem is listed with its spreadsheet line
 *    number, so the sheet can be fixed and uploaded again. A half-imported catalogue is harder to repair than a fixed file.
 *  • The same rules as the Add product form (lib/validation/admin-catalogue.ts): blank = "not entered" (NULL), never 0.
 *  • Prices, GST and HSN are the OWNER's: a staff account that fills those columns is refused, like in the form.
 *  • Create only. It never changes or deletes an existing product; a clash on web address or SKU is an error.
 *  • The server re-checks the whole file on the real import; it never trusts an earlier preview.
 */
export const MAX_IMPORT_ROWS = 300;
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** The columns, in the order of the template. */
export const IMPORT_COLUMNS = [
  "name",
  "category",
  "brand",
  "short_description",
  "description",
  "unit",
  "pack_size",
  "sku",
  "min_order_quantity",
  "stock",
  "tags",
  "status",
  "featured",
  "slug",
  "purchase_price",
  "wholesale_price",
  "retail_price",
  "gst_percent",
  "hsn_code",
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];

const OWNER_ONLY: readonly Column[] = ["purchase_price", "wholesale_price", "retail_price", "gst_percent", "hsn_code"];

const ALIASES: Record<string, Column> = {
  product: "name",
  product_name: "name",
  stock_quantity: "stock",
  quantity: "stock",
  min_order: "min_order_quantity",
  moq: "min_order_quantity",
  gst: "gst_percent",
  gst_rate: "gst_percent",
  gst_rate_percent: "gst_percent",
  hsn: "hsn_code",
  packsize: "pack_size",
  short: "short_description",
};

const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export interface RowProblem {
  line: number;
  messages: string[];
}

export interface PreviewRow {
  line: number;
  name: string;
  category: string;
  brand: string | null;
  status: string;
  hasPrices: boolean;
}

export type ImportAnalysis =
  | { ok: true; total: number; rows: PreviewRow[] }
  | { ok: false; total: number; fileError?: string; problems: RowProblem[] };

interface Prepared {
  line: number;
  data: ProductInput & { slug: string };
  preview: PreviewRow;
}

type Analysis = { ok: true; prepared: Prepared[] } | { ok: false; total: number; fileError?: string; problems: RowProblem[] };

const truthy = (v: string) => (/^(yes|y|true|1|on)$/i.test(v.trim()) ? "on" : "");

async function analyse(csvText: string, session: AdminSession): Promise<Analysis> {
  const parsed = parseCsv(csvText);
  if (parsed.error) return { ok: false, total: 0, fileError: parsed.error, problems: [] };
  const [header, ...body] = parsed.rows;
  if (!header) return { ok: false, total: 0, fileError: "The file is empty. Use the template and add one product per row.", problems: [] };
  if (header.length === 1 && /;/.test(header[0]!)) {
    return { ok: false, total: 0, fileError: "The columns are separated by semicolons. In Excel or Google Sheets choose “CSV (comma separated, UTF-8)” when you save.", problems: [] };
  }
  if (body.length === 0) return { ok: false, total: 0, fileError: "The file has a header row but no products.", problems: [] };
  if (body.length > MAX_IMPORT_ROWS) return { ok: false, total: body.length, fileError: `At most ${MAX_IMPORT_ROWS} products per file (this one has ${body.length}). Split it into smaller files.`, problems: [] };

  // Header → column. A wrong or unknown column name is an error, so a typo can never silently drop a price.
  const columnAt: (Column | null)[] = [];
  const unknown: string[] = [];
  const seen = new Set<Column>();
  const dupHeaders: string[] = [];
  for (const raw of header) {
    const key = normaliseHeader(raw);
    const column = (IMPORT_COLUMNS as readonly string[]).includes(key) ? (key as Column) : ALIASES[key];
    if (!column) {
      unknown.push(raw.trim() || "(blank)");
      columnAt.push(null);
      continue;
    }
    if (seen.has(column)) dupHeaders.push(column);
    seen.add(column);
    columnAt.push(column);
  }
  const fileErrors: string[] = [];
  if (unknown.length) fileErrors.push(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `“${u}”`).join(", ")}. Rename or delete ${unknown.length > 1 ? "them" : "it"} (see the list of columns on this page).`);
  if (dupHeaders.length) fileErrors.push(`The column “${dupHeaders[0]}” appears twice.`);
  for (const required of ["name", "category"] as const) if (!seen.has(required)) fileErrors.push(`The “${required}” column is missing.`);
  if (fileErrors.length) return { ok: false, total: body.length, fileError: fileErrors.join(" "), problems: [] };

  const db = getDb();
  const [categories, brands, existing] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true } }),
    db.brand.findMany({ select: { id: true, name: true, slug: true } }),
    db.product.findMany({ select: { slug: true, sku: true } }),
  ]);
  const byNameOrSlug = <T extends { id: string; name: string; slug: string }>(items: T[]) => {
    const map = new Map<string, T>();
    for (const item of items) {
      map.set(item.name.trim().toLowerCase(), item);
      map.set(item.slug, item);
    }
    return map;
  };
  const categoryMap = byNameOrSlug(categories);
  const brandMap = byNameOrSlug(brands);
  const takenSlugs = new Set(existing.map((p) => p.slug));
  const takenSkus = new Set(existing.map((p) => p.sku).filter((v): v is string => Boolean(v)));

  const problems: RowProblem[] = [];
  const prepared: Prepared[] = [];
  const owner = session.role === "OWNER";

  body.forEach((cells, index) => {
    const line = index + 2; // the header is line 1 in the spreadsheet
    const messages: string[] = [];
    const get = (column: Column) => {
      const at = columnAt.indexOf(column);
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };
    if (cells.length > header.length && cells.slice(header.length).some((c) => c.trim() !== "")) messages.push("This row has more cells than the header has columns. A cell with a comma in it must be in quotes.");

    if (!owner) {
      const filled = OWNER_ONLY.filter((c) => get(c) !== "");
      if (filled.length) messages.push(`Only the owner can import ${filled.join(", ").replace(/_/g, " ")}. Leave those cells empty or ask the owner to import this file.`);
    }

    const categoryName = get("category");
    const category = categoryMap.get(categoryName.toLowerCase());
    if (!categoryName) messages.push("Category is empty.");
    else if (!category) messages.push(`Category “${categoryName}” does not exist. Add it under Categories first, or fix the spelling.`);
    const brandName = get("brand");
    const brand = brandName ? brandMap.get(brandName.toLowerCase()) : undefined;
    if (brandName && !brand) messages.push(`Brand “${brandName}” does not exist. Add it under Brands first, or fix the spelling.`);

    const status = get("status").toUpperCase() || "DRAFT";
    const result = productSchema.safeParse({
      name: get("name"),
      slug: get("slug"),
      categoryId: category?.id ?? "x",
      brandId: brand?.id ?? "",
      shortDescription: get("short_description"),
      description: get("description"),
      unit: get("unit"),
      packSize: get("pack_size"),
      sku: get("sku"),
      hsnCode: get("hsn_code"),
      gstRatePercent: get("gst_percent"),
      purchasePrice: get("purchase_price"),
      wholesalePrice: get("wholesale_price"),
      retailPrice: get("retail_price"),
      stockQuantity: get("stock"),
      minOrderQuantity: get("min_order_quantity"),
      tags: get("tags").replace(/[;|]/g, ","),
      status,
      isFeatured: truthy(get("featured")),
    });
    if (!result.success) {
      const seenFields = new Set<string>();
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "categoryId" || seenFields.has(field)) continue;
        seenFields.add(field);
        messages.push(`${field === "status" ? "Status must be DRAFT, ACTIVE or INACTIVE" : `${labelFor(field)}: ${issue.message}`}.`.replace(/\.\.$/, "."));
      }
    }

    // Clashes are reported even when another cell of the same row is wrong, so one pass lists everything to fix.
    const rawSlug = get("slug");
    if (rawSlug && takenSlugs.has(rawSlug)) messages.push(`The web address “${rawSlug}” is already used by another product.`);
    const rawSku = get("sku");
    if (rawSku && takenSkus.has(rawSku)) messages.push(`SKU “${rawSku}” is already used by another product${prepared.some((p) => p.data.sku === rawSku) ? " in this file" : ""}.`);

    if (result.success) {
      const data = result.data;
      // Web address: an explicit one was checked above; otherwise make one from the name and add -2, -3… if it is taken.
      let slug = data.slug;
      if (!slug) {
        const base = slugify(data.name) || "product";
        slug = base;
        for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
      }
      if (messages.length === 0 && category) {
        takenSlugs.add(slug);
        if (data.sku) takenSkus.add(data.sku);
        prepared.push({
          line,
          data: { ...data, slug },
          preview: { line, name: data.name, category: categoryName, brand: brand ? brandName : null, status: data.status, hasPrices: Boolean(data.wholesalePrice || data.retailPrice || data.purchasePrice) },
        });
      }
    }
    if (messages.length) problems.push({ line, messages });
  });

  if (problems.length) return { ok: false, total: body.length, problems };
  return { ok: true, prepared };
}

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  brandId: "Brand",
  shortDescription: "Short description",
  description: "Description",
  unit: "Unit",
  packSize: "Pack size",
  sku: "SKU",
  hsnCode: "HSN code",
  gstRatePercent: "GST percent",
  purchasePrice: "Purchase price",
  wholesalePrice: "Wholesale price",
  retailPrice: "Retail price",
  stockQuantity: "Stock",
  minOrderQuantity: "Min order quantity",
  tags: "Tags",
  isFeatured: "Featured",
};
const labelFor = (field: string) => FIELD_LABEL[field] ?? field;

/** Checks the file and says what an import would do. Writes nothing. */
export async function previewProductImport(csvText: string): Promise<ImportAnalysis> {
  const session = await requireAdmin();
  const result = await analyse(csvText, session);
  if (!result.ok) return result;
  return { ok: true, total: result.prepared.length, rows: result.prepared.slice(0, 50).map((p) => p.preview) };
}

export type ImportResult = { ok: true; created: number } | { ok: false; message: string; fileError?: string; problems: RowProblem[] };

/** Re-checks the whole file and, only if every row is fine, creates every product in one step. */
export async function importProducts(csvText: string): Promise<ImportResult> {
  const session = await requireAdmin();
  const result = await analyse(csvText, session);
  if (!result.ok) return { ok: false, message: result.fileError ?? "Some rows need fixing. Nothing was imported.", fileError: result.fileError, problems: result.problems };
  try {
    const { count } = await getDb().product.createMany({
      data: result.prepared.map(({ data }) => ({ ...data })),
    });
    invalidateCatalogueSnapshot();
    revalidatePath("/", "layout");
    return { ok: true, created: count };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    console.error("[admin] importProducts failed:", error instanceof Error ? error.message : "unknown");
    return {
      ok: false,
      message: code === "P2002" ? "Someone added a product with the same web address or SKU while you were importing. Nothing was imported — check the file again." : "The import could not be saved. Nothing was imported. Please try again.",
      problems: [],
    };
  }
}
