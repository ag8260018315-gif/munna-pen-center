import { createHash } from "node:crypto";

const MAX_DEPTH = 32;

/**
 * Canonical JSON text of `value`: object keys sorted, no whitespace, array order kept.
 *
 * The hash is the owner's guarantee that "what I approved" is "what runs", so this refuses anything it could
 * silently flatten into something else instead of guessing:
 *  - values with `toJSON` (Date, Prisma Decimal) are hashed by that text, exactly as `JSON.stringify` would write
 *    them — never by their internals (a Date has no own keys, so it would otherwise hash as `{}` and any date
 *    would match any other);
 *  - `undefined`, functions, symbols, bigint, NaN and ±Infinity are errors (JSON would drop or null them, so two
 *    different payloads could share a hash);
 *  - Map, Set and class instances are errors (convert to plain data first);
 *  - circular structures are errors.
 */
function canonicalJson(value: unknown, depth: number, path: string, viaToJson = false): string {
  if (depth > MAX_DEPTH) throw new TypeError(`Payload is nested too deeply (at ${path}).`);

  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new TypeError(`Payload contains a non-finite number at ${path}.`);
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new TypeError(`Payload contains a ${typeof value} at ${path}; only plain JSON data can be approved.`);
  }

  // Date.prototype.toJSON() returns null for an invalid date, which would hash like an explicit null.
  if (value instanceof Date && Number.isNaN(value.getTime())) throw new TypeError(`Payload contains an invalid Date at ${path}.`);

  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === "function") {
    if (viaToJson) throw new TypeError(`Payload value at ${path} serialises to another object with toJSON.`);
    const json: unknown = toJSON.call(value);
    if (json === undefined) throw new TypeError(`Payload value at ${path} has no JSON form (invalid Date?).`);
    return canonicalJson(json, depth + 1, path, true);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, depth + 1, `${path}[${index}]`)).join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Payload contains a non-plain object at ${path}; convert it to plain data first.`);
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner, depth + 1, `${path}.${key}`)}`).join(",")}}`;
}

/**
 * SHA-256 (hex) of the exact change an approval covers — recipient, lines, prices, totals, message text.
 * An `ApprovalRequest` stores this hash when it is created; `canExecute` only lets an action run if the
 * hash of what is about to run is IDENTICAL. Change a price after the owner approved and the hash differs,
 * so the approval no longer applies.
 *
 * Throws `TypeError` for payloads that cannot be represented exactly (see `canonicalJson`).
 * Server-side only (uses node:crypto), so it is deliberately not re-exported from the package index.
 */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload, 0, "payload")).digest("hex");
}

/**
 * Does `payload` hash to `expectedHash`? The executor calls this with the payload it is ABOUT to run (read back
 * from `ApprovalRequest.payload`, never from the model) before it asks `canExecute`. Unhashable payloads → false.
 */
export function payloadMatchesHash(payload: unknown, expectedHash: string): boolean {
  try {
    return expectedHash !== "" && hashPayload(payload) === expectedHash;
  } catch {
    return false;
  }
}
