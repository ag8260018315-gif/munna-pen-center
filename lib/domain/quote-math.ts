/**
 * Money arithmetic for quotations — exact, in paise (BigInt), never floating point.
 *
 *  line total = quantity × unit price
 *  line GST   = line total × rate %, rounded half-up to the paisa, PER LINE
 *  Prices are EX-GST; GST is added on top.
 *
 * A quotation total exists only when every line has both a price and a GST rate. Until then the totals are NULL —
 * a draft never shows a made-up number.
 */

export const MAX_RUPEES = 9_999_999_999n; // database column is Decimal(12,2)

/** "1250.5" → 125050n paise. Accepts at most 2 decimals; returns null for anything else. */
export function toPaise(amount: string | number | { toString(): string } | null | undefined): bigint | null {
  if (amount === null || amount === undefined) return null;
  const text = amount.toString().trim();
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
}

export function fromPaise(paise: bigint): string {
  const whole = paise / 100n;
  const frac = (paise % 100n).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

/** "18" / "12.5" → basis points of a percent: 1800 / 1250 (two decimals allowed). */
export function rateToBasisPoints(rate: string | number | { toString(): string } | null | undefined): bigint | null {
  if (rate === null || rate === undefined) return null;
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(rate.toString().trim());
  if (!m) return null;
  const bp = BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return bp <= 10_000n ? bp : null;
}

export interface QuoteLineInput {
  quantity: number;
  unitPrice: string | null;
  gstRatePercent: string | null;
}

export interface LineAmounts {
  lineTotal: string | null; // quantity × price, ex-GST
  tax: string | null; // needs a price and a GST rate
}

export interface QuoteTotals {
  lines: LineAmounts[];
  /** NULL unless EVERY line is priced and has a GST rate (and there is at least one line). */
  subtotal: string | null;
  taxTotal: string | null;
  total: string | null;
  /** True when a line's amount is too large for the database. */
  overflow: boolean;
}

export function computeQuote(lines: readonly QuoteLineInput[]): QuoteTotals {
  let overflow = false;
  let complete = lines.length > 0;
  let subtotal = 0n;
  let tax = 0n;
  const out: LineAmounts[] = lines.map((line) => {
    const price = toPaise(line.unitPrice);
    if (price === null || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      complete = false;
      return { lineTotal: null, tax: null };
    }
    const total = price * BigInt(line.quantity);
    if (total > MAX_RUPEES * 100n + 99n) overflow = true;
    const bp = rateToBasisPoints(line.gstRatePercent);
    if (bp === null) {
      complete = false;
      subtotal += total;
      return { lineTotal: fromPaise(total), tax: null };
    }
    const lineTax = (total * bp + 5_000n) / 10_000n; // half-up
    subtotal += total;
    tax += lineTax;
    return { lineTotal: fromPaise(total), tax: fromPaise(lineTax) };
  });
  if (subtotal + tax > MAX_RUPEES * 100n + 99n) overflow = true;
  return {
    lines: out,
    subtotal: complete && !overflow ? fromPaise(subtotal) : null,
    taxTotal: complete && !overflow ? fromPaise(tax) : null,
    total: complete && !overflow ? fromPaise(subtotal + tax) : null,
    overflow,
  };
}

/** Indian financial year (April–March) of a date, in IST: "2026-27". */
export function financialYearOf(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1; // April = month 3
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const quotationNumber = (financialYear: string, sequence: number) => `QT-${financialYear}-${String(sequence).padStart(4, "0")}`;

/** "1179998820.00" → "₹11,79,99,88,20.00"-style Indian grouping, from the exact decimal string (no floating point). */
export function formatRupees(amount: string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!m) return "—";
  const whole = m[1]!;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `₹${grouped}.${(m[2] ?? "").padEnd(2, "0") || "00"}`;
}
