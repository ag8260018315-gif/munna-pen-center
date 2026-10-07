import "server-only";
import { getServerEnv } from "@/lib/env";
import { normaliseGstin } from "@/lib/gstin";

/**
 * The business's GSTIN, from the server-only BUSINESS_GSTIN environment variable — never from source code.
 *
 * Returns null when it is not set or not a valid GSTIN, and the page then simply leaves it out. A mistyped value must
 * NEVER break a build or a page — it only controls whether a line of text is shown — so a problem is logged once,
 * without the value, and treated as "not set". (Invoices, later, will insist on a valid one.)
 */
let warned = false;

export function getBusinessGstin(): string | null {
  let raw: string | undefined;
  try {
    raw = getServerEnv().BUSINESS_GSTIN;
  } catch {
    // Another variable is malformed; that is reported where it matters. Don't let it hide a footer line.
    return null;
  }
  const result = normaliseGstin(raw);
  if (result.problem && !warned) {
    warned = true;
    console.warn(`[config] ${result.problem}`);
  }
  return result.gstin;
}
