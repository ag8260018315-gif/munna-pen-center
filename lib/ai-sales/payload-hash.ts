import { createHash } from "node:crypto";

/**
 * Canonical JSON: object keys sorted recursively, so two payloads that mean the same thing always
 * serialise identically (array order is meaningful and kept).
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, inner]) => [key, canonical(inner)]),
    );
  }
  return value;
}

/**
 * SHA-256 (hex) of the exact change an approval covers — recipient, lines, prices, totals, message text.
 * An `ApprovalRequest` stores this hash when it is created; `canExecute` only lets an action run if the
 * hash of what is about to run is IDENTICAL. Change a price after the owner approved and the hash differs,
 * so the approval no longer applies.
 *
 * Server-side only (uses node:crypto), so it is deliberately not re-exported from the package index.
 */
export function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(payload)) ?? "null")
    .digest("hex");
}
