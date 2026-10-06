/**
 * Indian phone-number helpers.
 *
 * All numbers are stored in E.164 (`+91XXXXXXXXXX`). WhatsApp's `wa.me` links want
 * the same number with no `+`, spaces or leading zeros (`91XXXXXXXXXX`).
 */

const INDIA_COUNTRY_CODE = "91";

/**
 * Normalises an Indian mobile number typed in any common format
 * ("7979025166", "+91 79790 25166", "07979025166", "91-7979025166") to E.164.
 * Returns `null` when the input is not a valid 10-digit Indian mobile number
 * (Indian mobiles start with 6, 7, 8 or 9).
 */
export function normaliseIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);

  if (digits.length === 12 && digits.startsWith(INDIA_COUNTRY_CODE)) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+${INDIA_COUNTRY_CODE}${digits}`;
}

/** E.164 (`+917979025166`) → WhatsApp format (`917979025166`). */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** E.164 (`+917979025166`) → display format (`+91 79790 25166`). */
export function formatIndianPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const national = digits.startsWith(INDIA_COUNTRY_CODE) ? digits.slice(2) : digits;
  return `+${INDIA_COUNTRY_CODE} ${national.slice(0, 5)} ${national.slice(5)}`;
}
