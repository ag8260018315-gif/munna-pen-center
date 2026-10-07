import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AdminRole } from "@/lib/auth/guard-types";

/**
 * Server-side admin sessions.
 *
 * The browser holds only a random token in an HttpOnly cookie. The database stores the SHA-256 HASH of that token, so a
 * copied table or backup can not be used to sign in. A session ends at an absolute deadline and after a period of
 * inactivity, and signing out (or deactivating the user) removes it immediately.
 */
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000; // absolute
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // since last request
const TOUCH_EVERY_MS = 5 * 60 * 1000; // don't write to the database on every click

export const isProductionRuntime = () => process.env.NODE_ENV === "production";

/** `__Host-` pins the cookie to this exact host over HTTPS (no Domain, Path=/, Secure); only usable in production. */
export const sessionCookieName = () => (isProductionRuntime() ? "__Host-mpc_admin" : "mpc_admin");

export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, secure: isProductionRuntime(), sameSite: "lax" as const, path: "/", expires };
}

export const generateSessionToken = () => randomBytes(32).toString("base64url");
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
}

export async function createSession(db: PrismaClient, userId: string, userAgent: string | null, now = new Date()) {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  await db.adminSession.create({
    data: { tokenHash: hashSessionToken(token), expiresAt, lastSeenAt: now, userAgent: userAgent?.slice(0, 200) ?? null, adminUserId: userId },
  });
  return { token, expiresAt };
}

/** The signed-in user for this cookie value, or null. Expired, idle and deactivated-user sessions are removed. */
export async function findSession(db: PrismaClient, token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const tokenHash = hashSessionToken(token);
  const session = await db.adminSession.findUnique({ where: { tokenHash }, include: { adminUser: true } });
  if (!session) return null;

  const expired = session.expiresAt <= now;
  const idle = now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS;
  if (expired || idle || !session.adminUser.isActive) {
    await db.adminSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  const { id, email, name, role } = session.adminUser;
  return { userId: id, email, name, role };
}

export async function deleteSession(db: PrismaClient, token: string | undefined) {
  if (!token) return;
  await db.adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Removes every session of a user ("sign out everywhere"; also after a password change). */
export async function deleteAllSessions(db: PrismaClient, userId: string) {
  await db.adminSession.deleteMany({ where: { adminUserId: userId } });
}
