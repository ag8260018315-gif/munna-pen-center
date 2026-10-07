import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, memory-hard, no extra dependency).
 *
 * Stored form: `scrypt$N$r$p$<salt base64url>$<hash base64url>` — the cost parameters travel with the hash, so they can
 * be raised later without locking anyone out. A fresh random salt per password, constant-time comparison.
 */
const COST = { N: 2 ** 15, r: 8, p: 1 } as const; // ~32 MiB and tens of milliseconds per hash
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 128 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

function derive(password: string, salt: Buffer, options: ScryptOptions & { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** True only for the exact password. Anything malformed (including a missing hash) is simply "no". */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || password.length > PASSWORD_MAX_LENGTH) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  // Refuse absurd parameters from a corrupted or hostile row instead of letting them exhaust memory.
  if (![N, r, p].every(Number.isInteger) || N < 2 ** 10 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 8) return false;
  try {
    const salt = Buffer.from(parts[4]!, "base64url");
    const expected = Buffer.from(parts[5]!, "base64url");
    if (salt.length < 8 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt, { N, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same time as a real check. Used when the e-mail is unknown, the account is locked or inactive, so response
 * time does not reveal which accounts exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("not-a-real-password-just-to-spend-the-same-time");
  await verifyPassword(password, await dummyHash);
  return false;
}

/** A readable reason the new password is not acceptable, or null when it is fine. */
export function checkNewPassword(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (new Set(password).size < 5) return "Use a more varied password (not the same few characters repeated).";
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  if (localPart.length >= 4 && password.toLowerCase().includes(localPart)) return "Do not include your e-mail name in the password.";
  if (/^(password|qwerty|letmein|admin|welcome|123456|munna)/i.test(password)) return "That password is too easy to guess.";
  return null;
}
