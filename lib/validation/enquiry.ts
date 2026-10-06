import { z } from "zod";
import { INDIA_STATES_AND_UTS } from "@/lib/domain/india";
import { LIMITS } from "@/lib/validation/limits";
import { normaliseIndianMobile } from "@/lib/phone";

/**
 * Validation for the public enquiry forms. This file is the single definition of
 * what a valid enquiry is — the server action is authoritative; the HTML form
 * mirrors the `required` / `maxLength` attributes for instant browser feedback.
 *
 * Which fields are required is a business decision — change it here.
 */

export { LIMITS };

/** Trimmed, optional text. Empty strings become `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Please enter ${label}`)
    .max(max, `Please keep this under ${max} characters`);

const name = requiredText("your name", 2, LIMITS.name);

const phone = z
  .string()
  .trim()
  .min(1, "Please enter your phone / WhatsApp number")
  .refine((value) => normaliseIndianMobile(value) !== null, "Enter a valid 10-digit Indian mobile number")
  .transform((value) => normaliseIndianMobile(value) as string);

const email = z
  .string()
  .trim()
  .max(LIMITS.email)
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.email("Enter a valid email address").optional());

const state = z.enum(INDIA_STATES_AND_UTS, { error: "Please select your state / UT" });

/** Spam trap: real users never see or fill this field. */
const honeypot = z.string().optional();

const itemSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  quantity: optionalText(LIMITS.itemQuantity),
});

/** Bulk-order and request-quote forms. */
export const bulkEnquirySchema = z
  .object({
    kind: z.enum(["bulk-order", "quote"]),
    name,
    organization: optionalText(LIMITS.organization),
    phone,
    email,
    city: requiredText("your city", 2, LIMITS.city),
    state,
    productsRequired: optionalText(LIMITS.productsRequired),
    approximateQuantity: optionalText(LIMITS.approximateQuantity),
    additionalRequirements: optionalText(LIMITS.additionalRequirements),
    items: z.array(itemSchema).max(LIMITS.maxItems).default([]),
    website: honeypot,
  })
  .superRefine((value, ctx) => {
    if (!value.productsRequired && value.items.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["productsRequired"],
        message: "Please tell us which products you need",
      });
    }
  });

/** General contact form. */
export const contactSchema = z.object({
  kind: z.literal("contact"),
  name,
  phone,
  email,
  message: requiredText("a message", 5, LIMITS.contactMessage),
  website: honeypot,
});

export type BulkEnquiryInput = z.output<typeof bulkEnquirySchema>;
export type ContactInput = z.output<typeof contactSchema>;

/** Flattens zod issues to `{ fieldName: firstMessage }` for rendering next to inputs. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Reads the repeated `itemSlug` / `itemQuantity` inputs off a FormData into `{slug, quantity}[]`. */
export function readItems(formData: FormData): { slug: string; quantity?: string }[] {
  const slugs = formData.getAll("itemSlug").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  return slugs.map((slug, index) => ({ slug, quantity: quantities[index] ?? "" }));
}

/** Plain string values of a FormData (for re-populating the form after an error). Skips files and the honeypot. */
export function readValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website" && !key.startsWith("item") && !key.startsWith("$ACTION")) {
      values[key] = value;
    }
  }
  return values;
}
