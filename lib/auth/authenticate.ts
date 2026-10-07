import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { checkNewPassword, hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export type LoginResult = { ok: true; token: string; expiresAt: Date } | { ok: false };

/**
 * Checks an e-mail and password. Every failure looks the same to the caller (unknown e-mail, wrong password, locked,
 * deactivated, no password set) and takes about the same time, so the form never reveals which accounts exist.
 */
export async function attemptLogin(
  db: PrismaClient,
  emailInput: string,
  password: string,
  userAgent: string | null,
  now = new Date(),
): Promise<LoginResult> {
  const user = await db.adminUser.findUnique({ where: { email: normaliseEmail(emailInput) } });
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > now);
  if (!user || !user.isActive || !user.passwordHash || locked) {
    await verifyAgainstDummy(password);
    return { ok: false };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    // Atomic increment so parallel guesses can not slip under the limit.
    const { failedLoginCount } = await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } });
    if (failedLoginCount >= MAX_FAILED_LOGINS) {
      await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) } });
    }
    return { ok: false };
  }

  await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
  const session = await createSession(db, user.id, userAgent, now);
  return { ok: true, ...session };
}

/** Constant-time comparison for the one-time setup token. */
export function setupTokenMatches(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type FirstOwnerResult = { ok: true } | { ok: false; reason: "already-set-up" | "weak-password" | "invalid"; message?: string };

/**
 * Creates the first OWNER — and only if there are no admin users at all. The check and the insert run in one transaction
 * under an advisory lock, so two simultaneous setups can not both succeed.
 */
export async function createFirstOwner(db: PrismaClient, input: { email: string; name: string; password: string }): Promise<FirstOwnerResult> {
  const email = normaliseEmail(input.email);
  const name = input.name.trim();
  if (!email || !name) return { ok: false, reason: "invalid" };
  const weak = checkNewPassword(input.password, email);
  if (weak) return { ok: false, reason: "weak-password", message: weak };
  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7420001)`;
    if ((await tx.adminUser.count()) > 0) return { ok: false as const, reason: "already-set-up" as const };
    await tx.adminUser.create({ data: { email, name, role: "OWNER", passwordHash, isActive: true } });
    return { ok: true as const };
  });
}

export async function hasAnyAdminUser(db: PrismaClient): Promise<boolean> {
  return (await db.adminUser.count()) > 0;
}
