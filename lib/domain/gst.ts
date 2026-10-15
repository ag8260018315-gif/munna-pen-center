import { fromPaise, rateToBasisPoints, toPaise } from "@/lib/domain/quote-math";

/**
 * GST rules for a tax invoice, as pure functions (no database, no environment).
 *
 *  • Intra-state supply (the supplier's state = the place of supply): the rate is split equally into CGST and SGST.
 *  • Inter-state supply: the whole rate is IGST.
 *  • Tax is worked out PER LINE on the taxable value and rounded half-up to the paisa; for intra-state each of CGST and
 *    SGST is rounded separately (so they are always equal), and the invoice totals are the sums of the lines.
 *  • Place of supply for goods is where delivery ends (not necessarily where the buyer is registered).
 *
 * Not handled, on purpose: UTGST (supplier in a Union Territory without a legislature), exports / SEZ, reverse charge,
 * composition dealers, cess, e-invoicing (IRN). The invoice screens refuse or warn where one of these could apply.
 */

/** GST state / Union Territory codes (the first two digits of a GSTIN). */
export const GST_STATES: readonly { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

/** Union Territories without a legislature: an intra-UT supply carries UTGST instead of SGST (not supported here). */
export const UTGST_CODES: ReadonlySet<string> = new Set(["04", "26", "31", "35", "38"]);

export const stateByCode = (code: string | null | undefined) => GST_STATES.find((s) => s.code === code) ?? null;

/** The state code in the first two digits of a GSTIN, if it is one we know. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const code = (gstin ?? "").slice(0, 2);
  return stateByCode(code) ? code : null;
}

const normaliseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(state|union territory|ut|of|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ALIASES: Record<string, string> = {
  orissa: "21",
  "j and k": "01",
  jk: "01",
  "new delhi": "07",
  "nct delhi": "07",
  "delhi nct": "07",
  pondicherry: "34",
  uttaranchal: "05",
  chattisgarh: "22",
  "andaman nicobar": "35",
  "andaman and nicobar": "35",
  "andaman nicobar islands": "35",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "dadra nagar haveli": "26",
  "dadra and nagar haveli daman and diu": "26",
  "dadra and nagar haveli and daman and diu": "26",
};

/** "jharkhand", "Orissa", "J&K", "NCT of Delhi" … → the state, or null when the text is not a state we recognise. */
export function stateByName(name: string | null | undefined) {
  if (!name) return null;
  const key = normaliseName(name);
  if (!key) return null;
  const byName = GST_STATES.find((s) => normaliseName(s.name) === key);
  if (byName) return byName;
  const alias = ALIASES[key];
  return alias ? stateByCode(alias) : null;
}

// ───────────────────────────── tax split ─────────────────────────────

export type TaxMode = "INTRA_STATE" | "INTER_STATE";

export const taxModeFor = (supplierStateCode: string, placeOfSupplyCode: string): TaxMode => (supplierStateCode === placeOfSupplyCode ? "INTRA_STATE" : "INTER_STATE");

export interface TaxableLine {
  quantity: number;
  unitPrice: string; // ex-GST, rupees with up to 2 decimals
  gstRatePercent: string;
}

export interface TaxedLine {
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string; // taxable + all taxes
}

export interface InvoiceTaxes {
  mode: TaxMode;
  lines: TaxedLine[];
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  total: string;
  /** Per GST rate: what the HSN / rate summary at the foot of an invoice needs. */
  byRate: { ratePercent: string; taxable: string; cgst: string; sgst: string; igst: string }[];
}

/** Round half up: (n * 2 + d) / (2d) in integers, so no floating point is involved. */
const roundDiv = (numerator: bigint, denominator: bigint) => (numerator * 2n + denominator) / (denominator * 2n);

/** Returns null if any line has a value the money rules do not accept (never a guess). */
export function computeInvoiceTaxes(lines: readonly TaxableLine[], mode: TaxMode): InvoiceTaxes | null {
  const out: TaxedLine[] = [];
  const rows: { bp: bigint; taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint }[] = [];
  let subtotal = 0n;
  let cgstTotal = 0n;
  let sgstTotal = 0n;
  let igstTotal = 0n;
  for (const line of lines) {
    const price = toPaise(line.unitPrice);
    const bp = rateToBasisPoints(line.gstRatePercent);
    if (price === null || bp === null || !Number.isSafeInteger(line.quantity) || line.quantity < 1) return null;
    const taxable = price * BigInt(line.quantity);
    let cgst = 0n;
    let sgst = 0n;
    let igst = 0n;
    if (mode === "INTRA_STATE") {
      cgst = roundDiv(taxable * bp, 20_000n);
      sgst = cgst;
    } else {
      igst = roundDiv(taxable * bp, 10_000n);
    }
    subtotal += taxable;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    out.push({ taxable: fromPaise(taxable), cgst: fromPaise(cgst), sgst: fromPaise(sgst), igst: fromPaise(igst), total: fromPaise(taxable + cgst + sgst + igst) });
    rows.push({ bp, taxable, cgst, sgst, igst });
  }
  const byBp = new Map<bigint, { taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint }>();
  for (const r of rows) {
    const cur = byBp.get(r.bp) ?? { taxable: 0n, cgst: 0n, sgst: 0n, igst: 0n };
    byBp.set(r.bp, { taxable: cur.taxable + r.taxable, cgst: cur.cgst + r.cgst, sgst: cur.sgst + r.sgst, igst: cur.igst + r.igst });
  }
  return {
    mode,
    lines: out,
    subtotal: fromPaise(subtotal),
    cgstTotal: fromPaise(cgstTotal),
    sgstTotal: fromPaise(sgstTotal),
    igstTotal: fromPaise(igstTotal),
    total: fromPaise(subtotal + cgstTotal + sgstTotal + igstTotal),
    byRate: [...byBp.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([bp, v]) => ({ ratePercent: formatRate(bp), taxable: fromPaise(v.taxable), cgst: fromPaise(v.cgst), sgst: fromPaise(v.sgst), igst: fromPaise(v.igst) })),
  };
}

/** 1800n → "18", 1250n → "12.5", 25n → "0.25". */
export function formatRate(bp: bigint): string {
  const whole = bp / 100n;
  const frac = (bp % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

// ───────────────────────────── amount in words ─────────────────────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]!);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]!);
  return parts.join(" ");
}

/** Indian numbering (thousand, lakh, crore): 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six". */
export function integerInWords(value: bigint): string {
  if (value === 0n) return "Zero";
  let rest = value;
  const crore = rest / 10_000_000n;
  rest %= 10_000_000n;
  const lakh = Number(rest / 100_000n);
  rest %= 100_000n;
  const thousand = Number(rest / 1000n);
  const hundreds = Number(rest % 1000n);
  const parts: string[] = [];
  if (crore > 0n) parts.push(`${integerInWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${below1000(thousand)} Thousand`);
  if (hundreds > 0) parts.push(below1000(hundreds));
  return parts.join(" ");
}

/** "1234.50" → "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only". */
export function amountInWords(amount: string): string {
  const paise = toPaise(amount);
  if (paise === null) return "";
  const rupees = paise / 100n;
  const rest = Number(paise % 100n);
  const rupeeText = `Rupees ${integerInWords(rupees)}`;
  return rest > 0 ? `${rupeeText} and ${below1000(rest)} Paise Only` : `${rupeeText} Only`;
}

// ───────────────────────────── invoice number ─────────────────────────────

/**
 * GST invoice serial numbers may be at most 16 characters, using letters, digits, "/" and "-" (Rule 46, CGST Rules).
 * "INV/26-27/0001" is 14 characters and stays within 16 up to sequence 999999.
 */
export const INVOICE_PREFIX = "INV";
export const MAX_INVOICE_SEQUENCE = 999_999;

export function invoiceNumber(financialYear: string, sequence: number): string {
  const short = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!short || !Number.isInteger(sequence) || sequence < 1 || sequence > MAX_INVOICE_SEQUENCE) throw new Error("invoiceNumber: invalid financial year or sequence");
  return `${INVOICE_PREFIX}/${short[1]!.slice(2)}-${short[2]}/${String(sequence).padStart(4, "0")}`;
}
