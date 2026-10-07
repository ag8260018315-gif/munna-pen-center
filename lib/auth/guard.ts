import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { AdminRole, AdminSession } from "@/lib/auth/guard-types";
import { sessionCookieName, findSession } from "@/lib/auth/session";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";

/**
 * Admin access control — the single choke point for everything under /admin.
 *
 *  • Database configured → a real sign-in is required (HttpOnly session cookie checked against the AdminSession table).
 *  • No database, development → a clearly-labelled preview session, so the screens can be built without a database.
 *  • No database, production → the admin does not exist (404).
 *
 * `proxy.ts` is only a first filter. Every admin page AND every admin data function must call `requireAdmin()` itself:
 * layouts do not re-run on client navigation, and server actions can be POSTed directly.
 */
export type { AdminRole, AdminSession };

const DEV_PREVIEW_SESSION: AdminSession = {
  userId: "dev-preview",
  email: "preview@localhost",
  name: "Development preview",
  role: "OWNER",
  isPreview: true,
};

/** The signed-in admin, or null. Never redirects; safe to call from the sign-in pages. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isDatabaseConfigured()) return process.env.NODE_ENV !== "production" ? DEV_PREVIEW_SESSION : null;
  const token = (await cookies()).get(sessionCookieName())?.value;
  const user = await findSession(getDb(), token);
  return user ? { ...user, isPreview: false } : null;
});

export async function requireAdmin(): Promise<AdminSession> {
  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") notFound(); // closed: do not reveal the area
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Owner-only actions (approvals, users, settings…) must use this, not `requireAdmin()`. */
export async function requireOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "OWNER") notFound();
  return session;
}
