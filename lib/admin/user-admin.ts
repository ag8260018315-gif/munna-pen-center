import "server-only";
import { revalidatePath } from "next/cache";
import { normaliseEmail, verifyUserPassword } from "@/lib/auth/authenticate";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { checkNewPassword, hashPassword } from "@/lib/auth/password";
import { deleteAllSessions, deleteOtherSessions } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { fieldErrors } from "@/lib/validation/admin-catalogue";
import { changeOwnPasswordSchema, newStaffSchema, setPasswordSchema } from "@/lib/validation/admin-sales";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Admin users. Managing OTHER people's accounts is the owner's job (requireOwner); changing your OWN password is open to
 * every signed-in user (requireAdmin). Every exported function calls one of them first (a test checks this).
 *
 * Rules: staff accounts are created as STAFF only; nobody can deactivate themselves or the last active owner; setting
 * a password, deactivating or unlocking an account signs that person out everywhere; nothing is deleted (the database
 * also refuses to delete a user who has decided approvals or recorded payments).
 */

export type URes<T = { id: string }> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };

const GENERIC: URes = { ok: false, message: "Could not save. Please try again." };
const fail = (error: unknown, what: string): URes => {
  console.error(`[admin] ${what} failed:`, error instanceof Error ? error.message : "unknown");
  return GENERIC;
};

const publicUser = { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, failedLoginCount: true, lockedUntil: true, createdAt: true } as const;

export async function listAdminUsers() {
  await requireOwner();
  return getDb().adminUser.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: publicUser }); // never the password hash
}

export async function getAdminUser(id: string) {
  await requireOwner();
  return getDb().adminUser.findUnique({ where: { id }, select: publicUser });
}

export async function createStaffUser(raw: Record<string, string>): Promise<URes> {
  await requireOwner();
  const parsed = newStaffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const email = normaliseEmail(parsed.data.email);
  const weak = checkNewPassword(parsed.data.password, email);
  if (weak) return { ok: false, message: weak, fieldErrors: { password: weak } };
  try {
    const user = await getDb().adminUser.create({ data: { email, name: parsed.data.name, role: "STAFF", isActive: true, passwordHash: await hashPassword(parsed.data.password) }, select: { id: true } });
    revalidatePath("/admin/users");
    return { ok: true, id: user.id };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") return { ok: false, message: "An account with this e-mail already exists.", fieldErrors: { email: "An account with this e-mail already exists" } };
    return fail(error, "createStaffUser");
  }
}

/** The owner chooses a new password for ANOTHER person (to change your own, use changeOwnPassword). */
export async function setUserPassword(id: string, raw: Record<string, string>): Promise<URes> {
  const owner = await requireOwner();
  if (id === owner.userId) return { ok: false, message: "Use “Change my password” for your own account." };
  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const user = await db.adminUser.findUnique({ where: { id }, select: { email: true } });
    if (!user) return { ok: false, message: "That account no longer exists." };
    const weak = checkNewPassword(parsed.data.password, user.email);
    if (weak) return { ok: false, message: weak, fieldErrors: { password: weak } };
    const passwordHash = await hashPassword(parsed.data.password);
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
      await deleteAllSessions(tx as unknown as PrismaClient, id);
    });
    revalidatePath("/admin/users");
    return { ok: true, id };
  } catch (error) {
    return fail(error, "setUserPassword");
  }
}

export async function setUserActive(id: string, active: boolean): Promise<URes> {
  const owner = await requireOwner();
  if (id === owner.userId) return { ok: false, message: "You can not deactivate your own account." };
  try {
    const result = await getDb().$transaction(async (tx): Promise<URes> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7420002)`; // two owners deactivating each other at once must not both pass the check
      const user = await tx.adminUser.findUnique({ where: { id }, select: { role: true, isActive: true } });
      if (!user) return { ok: false, message: "That account no longer exists." };
      if (!active && user.role === "OWNER") {
        const otherOwners = await tx.adminUser.count({ where: { role: "OWNER", isActive: true, NOT: { id } } });
        if (otherOwners === 0) return { ok: false, message: "That is the last active owner account. It can not be deactivated." };
      }
      await tx.adminUser.update({ where: { id }, data: { isActive: active } });
      if (!active) await deleteAllSessions(tx as unknown as PrismaClient, id);
      return { ok: true, id };
    });
    if (result.ok) revalidatePath("/admin/users");
    return result;
  } catch (error) {
    return fail(error, "setUserActive");
  }
}

/** Lifts a sign-in lock (after five wrong passwords) without changing the password. */
export async function unlockUser(id: string): Promise<URes> {
  await requireOwner();
  try {
    const { count } = await getDb().adminUser.updateMany({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
    if (!count) return { ok: false, message: "That account no longer exists." };
    revalidatePath("/admin/users");
    return { ok: true, id };
  } catch (error) {
    return fail(error, "unlockUser");
  }
}

/** Anyone signed in can change their OWN password. Needs the current one; signs out every other browser. */
export async function changeOwnPassword(raw: Record<string, string>, currentToken: string | undefined): Promise<URes> {
  const session = await requireAdmin();
  if (session.isPreview) return { ok: false, message: "The development preview account has no password." };
  const parsed = changeOwnPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    if (!(await verifyUserPassword(db, session.userId, parsed.data.current))) {
      return { ok: false, message: "The current password is not correct, or the account is temporarily locked.", fieldErrors: { current: "That is not your current password" } };
    }
    const weak = checkNewPassword(parsed.data.password, session.email);
    if (weak) return { ok: false, message: weak, fieldErrors: { password: weak } };
    if (parsed.data.password === parsed.data.current) return { ok: false, message: "Choose a password you have not used just now.", fieldErrors: { password: "Choose a different password" } };
    const passwordHash = await hashPassword(parsed.data.password); // before the transaction: hashing takes a moment
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: session.userId }, data: { passwordHash } });
      await deleteOtherSessions(tx as unknown as PrismaClient, session.userId, currentToken);
    });
    return { ok: true, id: session.userId };
  } catch (error) {
    return fail(error, "changeOwnPassword");
  }
}

/** Signs this account out on every other device. */
export async function signOutOtherDevices(currentToken: string | undefined): Promise<URes> {
  const session = await requireAdmin();
  if (session.isPreview) return { ok: true, id: session.userId };
  try {
    await deleteOtherSessions(getDb(), session.userId, currentToken);
    return { ok: true, id: session.userId };
  } catch (error) {
    return fail(error, "signOutOtherDevices");
  }
}
