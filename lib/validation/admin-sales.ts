import { z } from "zod";
import { isGstinCheckCharacterValid } from "@/lib/gstin";

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
    z
      .string()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "That does not look like a GSTIN (15 characters)")
      .refine(isGstinCheckCharacterValid, "This GSTIN does not pass its check (its last character does not match the rest) — please re-check it")
      .nullable(),
  ),
  billingLine1: optText(200),
  billingCity: optText(80),
  billingState: optText(80),
  billingPincode: z.preprocess(blankToNull, z.string().regex(/^\d{6}$/, "PIN code is 6 digits").nullable()),
  notes: optText(2000),
});
export type CustomerInput = z.infer<typeof customerSchema>;

/** True for a real calendar day. `Date.parse` alone is not enough: it rolls "2026-02-31" over to 3 March instead of rejecting it. */
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A date typed as YYYY-MM-DD (from <input type="date">), valid until the END of that day in India. */
const optDate = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine(isCalendarDate, "Choose a valid date")
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

// ───────────────────────────── orders ─────────────────────────────

export const ORDER_ACTIONS = ["CONFIRM", "PROCESS", "DISPATCH", "DELIVER", "CANCEL"] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

/** Delivery address and internal notes on an order. Blank = not known (stored as NULL). */
export const orderDetailsSchema = z.object({
  shippingLine1: optText(200),
  shippingCity: optText(80),
  shippingState: optText(80),
  shippingPincode: z.preprocess(blankToNull, z.string().regex(/^\d{6}$/, "PIN code is 6 digits").nullable()),
  notes: optText(2000),
});

export const dispatchSchema = z.object({
  transporter: optText(120),
  trackingReference: optText(120),
});

// ───────────────────────────── invoices and payments ─────────────────────────────

export const invoiceDraftSchema = z.object({
  /** Two-digit GST state code of the place of supply, e.g. "20". */
  placeOfSupplyCode: z.string().trim().regex(/^\d{2}$/, "Choose the state goods are delivered to"),
  dueDate: optDate,
});

export const invoiceLineHsnSchema = z.object({
  hsnCode: z.preprocess(blankToNull, z.string().regex(/^\d{4,8}$/, "HSN is 4 to 8 digits").nullable()),
});

export const PAYMENT_METHODS = ["UPI", "BANK_TRANSFER", "CHEQUE", "CASH", "CARD", "OTHER"] as const;
export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer (NEFT / RTGS / IMPS)",
  CHEQUE: "Cheque",
  CASH: "Cash",
  CARD: "Card",
  OTHER: "Other",
};

export const paymentSchema = z.object({
  amount: z.preprocess(
    (v) => blankToNull(typeof v === "string" ? v.replace(/[,\s₹]/g, "") : v),
    z.string({ error: "Enter the amount received" }).regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount in rupees, e.g. 5000 or 5000.50").refine((v) => Number(v) > 0, "The amount must be more than zero"),
  ),
  method: z.enum(PAYMENT_METHODS, "Choose how it was paid"),
  /** UTR / UPI reference / cheque number. */
  reference: optText(100),
  /** The day the money arrived (YYYY-MM-DD). */
  paidOn: z
    .string({ error: "Choose the date" })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date the money arrived")
    .refine(isCalendarDate, "Choose a valid date"),
  notes: optText(500),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Say why (at least 3 characters)").max(300),
});

// ───────────────────────────── admin users ─────────────────────────────

export const newStaffSchema = z
  .object({
    name: z.string().trim().min(2, "Enter their name").max(100),
    email: z.string().trim().pipe(z.email("Enter a valid e-mail").max(254)),
    password: z.string().max(128),
    confirm: z.string().max(128),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });

export const setPasswordSchema = z
  .object({ password: z.string().max(128), confirm: z.string().max(128) })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });

export const changeOwnPasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password").max(128), password: z.string().max(128), confirm: z.string().max(128) })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });

export const recoverySchema = z
  .object({
    key: z.string().min(1, "Enter the setup key").max(300),
    email: z.string().trim().pipe(z.email("Enter a valid e-mail").max(254)),
    password: z.string().max(128),
    confirm: z.string().max(128),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });
