import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { normaliseEmail } from "@/lib/auth/authenticate";
import { checkNewPassword, hashPassword, verifyAgainstDummy } from "@/lib/auth/password";
import { deleteAllSessions } from "@/lib/auth/session";

/**
 * Password recovery without e-mail: whoever controls the project's Vercel settings can set `ADMIN_SETUP_TOKEN` and use
 * /admin/reset to choose a new password for an account. The key must be long enough that guessing it is hopeless.
 */
export const MIN_RECOVERY_KEY_LENGTH = 16;

export const recoveryEnabled = (token: string | undefined): token is string => typeof token === "string" && token.length >= MIN_RECOVERY_KEY_LENGTH;

export type RecoveryResult = { ok: true } | { ok: false; reason: "unknown-account" | "weak-password"; message?: string };

/** Sets a new password, lifts any lock, and signs the account out everywhere. The caller has already checked the key. */
export async function resetPasswordWithKey(db: PrismaClient, input: { email: string; newPassword: string }): Promise<RecoveryResult> {
  const email = normaliseEmail(input.email);
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await verifyAgainstDummy(input.newPassword); // same time as a real reset
    return { ok: false, reason: "unknown-account" };
  }
  const weak = checkNewPassword(input.newPassword, email);
  if (weak) return { ok: false, reason: "weak-password", message: weak };
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await deleteAllSessions(tx as unknown as PrismaClient, user.id);
  });
  return { ok: true };
}
