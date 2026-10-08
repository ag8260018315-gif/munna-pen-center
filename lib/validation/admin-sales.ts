import { z } from "zod";

/** Shared helpers live in admin-catalogue.ts; this file adds customers and quotations. */
const blankToNull = (v: unknown) => (v === undefined || v === null ? null : typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v);
const optText = (max: number) => z.preprocess(blankToNull, z.string().max(max, `At most ${max} characters`).nullable());
const optMoney = z.preprocess(
  (v) => blankToNull(typeof v === "string" ? v.replace(/[,\s₹]/g, "") : v),
  z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount in rupees, e.g. 125 or 125.50").nullable(),
);
const optGst = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage, e.g. 18").refine((v) => Number(v) <= 100, "At most 100").nullable(),
);

export const CUSTOMER_TYPES = ["SCHOOL", "OFFICE", "ENGINEER", "BUSINESS", "INSTITUTION", "RETAILER", "OTHER"] as const;
export const CUSTOMER_TYPE_LABEL: Record<(typeof CUSTOMER_TYPES)[number], string> = {
  SCHOOL: "School",
  OFFICE: "Office",
  ENGINEER: "Engineer / contractor",
  BUSINESS: "Business",
  INSTITUTION: "Institution",
  RETAILER: "Retailer",
  OTHER: "Other",
};

export const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES, "Choose a type"),
  organizationName: z.string().trim().min(2, "Enter the organisation or shop name").max(150),
  contactName: z.string().trim().min(2, "Enter the contact person").max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .transform((v) => (/^\d{10}$/.test(v) ? `+91${v}` : /^91\d{10}$/.test(v) ? `+${v}` : v))
    .refine((v) => /^\+[1-9]\d{7,14}$/.test(v), "Enter a 10-digit mobile number"),
  email: z.preprocess(blankToNull, z.email("Enter a valid e-mail").max(254).nullable()),
  gstin: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.replace(/\s/g, "").toUpperCase() : null),
    z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "That does not look like a GSTIN (15 characters)").nullable(),
  ),
  billingLine1: optText(200),
  billingCity: optText(80),
  billingState: optText(80),
  billingPincode: z.preprocess(blankToNull, z.string().regex(/^\d{6}$/, "PIN code is 6 digits").nullable()),
  notes: optText(2000),
});
export type CustomerInput = z.infer<typeof customerSchema>;

/** A date typed as YYYY-MM-DD (from <input type="date">), valid until the END of that day in India. */
const optDate = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00+05:30`)), "Choose a valid date")
    .nullable(),
);

export const quotationHeaderSchema = z.object({
  validUntil: optDate,
  terms: optText(4000),
  notes: optText(2000),
});
export type QuotationHeaderInput = z.infer<typeof quotationHeaderSchema>;

export const lineSchema = z.object({
  productId: z.preprocess(blankToNull, z.string().max(60).nullable()),
  description: z.preprocess(blankToNull, z.string().min(1, "Describe the item").max(300).nullable()),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,8}$/, "Enter a whole number")
    .transform(Number)
    .refine((n) => n >= 1, "At least 1"),
  unit: z.string().trim().min(1, "Enter a unit, e.g. pcs").max(20),
  unitPrice: optMoney,
  gstRatePercent: optGst,
  hsnCode: z.preprocess(blankToNull, z.string().regex(/^\d{4,8}$/, "HSN is 4 to 8 digits").nullable()),
});
export type LineInput = z.infer<typeof lineSchema>;

export const QUOTE_STATUS_ACTIONS = ["SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const;
export type QuoteStatusAction = (typeof QUOTE_STATUS_ACTIONS)[number];
