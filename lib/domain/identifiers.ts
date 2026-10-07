import { randomBytes, randomUUID } from "node:crypto";

// Crockford-style base32 without ambiguous characters (no 0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Generates the internal id and the customer-facing reference for a new enquiry. */
export function generateEnquiryIdentity(now = new Date()): { id: string; reference: string } {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Array.from(randomBytes(4), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return { id: randomUUID(), reference: `ENQ-${date}-${suffix}` };
}
