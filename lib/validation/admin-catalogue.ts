import { z } from "zod";

/**
 * Validation for the admin catalogue forms. Rules:
 *  • An empty box means "not entered" (NULL) — never 0, never a default. Nothing is invented.
 *  • Money is INR with at most 2 decimals; GST 0–100; stock and minimum order are whole numbers.
 *  • Slugs are lower-case words joined by hyphens (the database enforces the same shape).
 */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

const blankToNull = (v: unknown) => (v === undefined || v === null ? null : typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v);

const optText = (max: number) => z.preprocess(blankToNull, z.string().max(max, `At most ${max} characters`).nullable());
const optMoney = z.preprocess(
  (v) => blankToNull(typeof v === "string" ? v.replace(/[,\s₹]/g, "") : v),
  z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount in rupees, e.g. 125 or 125.50")
    .nullable(),
);
const optGst = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage, e.g. 18")
    .refine((v) => Number(v) <= 100, "At most 100")
    .nullable(),
);
const optInt = (min: number, label: string) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^\d{1,9}$/, `${label}: enter a whole number`)
      .transform(Number)
      .refine((n) => n >= min, `${label}: at least ${min}`)
      .nullable(),
  );
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const sortOrder = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : "0"), z.string().regex(/^\d{1,5}$/, "Enter a whole number").transform(Number));

const slugField = z.preprocess(blankToNull, z.string().max(80).regex(SLUG, "Use lower-case letters, numbers and hyphens only").nullable());

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(150),
  slug: slugField,
  categoryId: z.string().trim().min(1, "Choose a category").max(60),
  brandId: z.preprocess(blankToNull, z.string().max(60).nullable()),
  shortDescription: optText(300),
  description: optText(4000),
  unit: optText(40),
  packSize: optText(120),
  sku: optText(60),
  hsnCode: z.preprocess(blankToNull, z.string().regex(/^\d{4,8}$/, "HSN is 4 to 8 digits").nullable()),
  gstRatePercent: optGst,
  purchasePrice: optMoney,
  wholesalePrice: optMoney,
  retailPrice: optMoney,
  stockQuantity: optInt(0, "Stock"),
  minOrderQuantity: optInt(1, "Minimum order"),
  tags: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : []),
    z.array(z.string().max(40)).max(20, "At most 20 tags"),
  ),
  status: z.enum(PRODUCT_STATUSES, "Choose a status"),
  isFeatured: checkbox,
});
export type ProductInput = z.infer<typeof productSchema>;

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Enter the brand name").max(80),
  slug: slugField,
  isListedPublicly: checkbox,
  isActive: checkbox,
  sortOrder,
});
export type BrandInput = z.infer<typeof brandSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter the category name").max(80),
  slug: slugField,
  summary: optText(300),
  description: optText(4000),
  sortOrder,
  isActive: checkbox,
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const stockSchema = z.object({ stockQuantity: optInt(0, "Stock") });

/** Fields as plain strings from a FormData — files and repeated keys are ignored. */
export function formToObject(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] ??= value;
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

export interface AdminFormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}
