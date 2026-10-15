/**
 * GSTIN handling that never throws and never echoes the value. Pure and dependency-free so it can be unit tested and
 * reused by the invoice code later.
 *
 * A GSTIN is 15 characters: 2-digit state code, 10-character PAN, entity number, "Z", check character. Only the SHAPE is
 * checked here (not the check digit, and not whether it is registered).
 */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstinResult = { gstin: string; problem?: undefined } | { gstin: null; problem: string | null };

/**
 * Tidies what a person typed into an environment-variable form — surrounding spaces/newlines, matching quote marks,
 * lower case — then checks the shape. Returns `{ gstin }` when it is usable, `{ gstin: null, problem: null }` when
 * it is simply not set, and `{ gstin: null, problem }` (a message that does NOT contain the value) when it is set but wrong.
 */
export function normaliseGstin(raw: string | undefined): GstinResult {
  let text = (raw ?? "").trim();
  const quote = text[0];
  if (text.length >= 2 && (quote === '"' || quote === "'" || quote === "`") && text.endsWith(quote)) text = text.slice(1, -1).trim();
  text = text.toUpperCase();

  if (!text) return { gstin: null, problem: null };
  if (GSTIN_PATTERN.test(text)) return { gstin: text };
  const hint =
    text.length !== 15
      ? `it has ${text.length} characters, a GSTIN has exactly 15`
      : "it is 15 characters but not in the GSTIN pattern (2 digits, 5 letters, 4 digits, 1 letter, 1 letter/digit, Z, 1 letter/digit)";
  return { gstin: null, problem: `BUSINESS_GSTIN is set but is not a valid GSTIN (${hint}); it will not be shown. Enter only the 15 characters, with no label, quotes or spaces.` };
}

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The 15th character of a GSTIN is a check character computed from the first 14 (the published mod-36 scheme: each character's
 * value is multiplied by 1 or 2 alternately, the product's base-36 digits are added, and the check is what makes the total a
 * multiple of 36). Returns null if `body` is not 14 letters/digits.
 */
export function gstinCheckCharacter(body: string): string | null {
  if (!/^[0-9A-Z]{14}$/.test(body)) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_ALPHABET.indexOf(body[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_ALPHABET[(36 - (sum % 36)) % 36]!;
}

/** True when the number has the GSTIN shape AND its check character is right — catches a mistyped digit that the shape check can not. */
export function isGstinCheckCharacterValid(gstin: string | null | undefined): boolean {
  const text = (gstin ?? "").toUpperCase();
  return GSTIN_PATTERN.test(text) && gstinCheckCharacter(text.slice(0, 14)) === text[14];
}
