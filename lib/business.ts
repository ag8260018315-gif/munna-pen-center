import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * The business's GSTIN, from the server-only BUSINESS_GSTIN environment variable — never from source code.
 * Returns null when it is not set (or not a valid GSTIN), and the UI then simply omits it. A bad value must not
 * take the whole site down, so a validation error is logged (without the value) and treated as "not set".
 */
export function getBusinessGstin(): string | null {
  try {
    return getServerEnv().BUSINESS_GSTIN ?? null;
  } catch (error) {
    console.error("[config] environment is invalid, GSTIN not shown:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
