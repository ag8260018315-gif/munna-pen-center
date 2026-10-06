import "server-only";
import { notFound } from "next/navigation";

/**
 * Admin access control — the single choke point for everything under /admin.
 *
 * STATUS (V1): no authentication provider is connected yet, so the admin area is CLOSED
 * in production: `requireAdmin()` responds with a 404 and `proxy.ts` rejects the request
 * before it renders. In development a clearly-labelled preview session lets the dashboard
 * shell be built and reviewed.
 *
 * PHASE 2: replace the body of `requireAdmin()` with a real session check (e.g. Auth.js or a
 * signed-cookie session backed by the AdminUser table, using AUTH_SECRET) and return the
 * authenticated user. Every admin page AND every admin data function must keep calling it:
 * a layout check alone is not enough, because layouts do not re-render on client navigation.
 */

export type AdminRole = "OWNER" | "STAFF";

export interface AdminSession {
  userId: string;
  email: string;
  role: AdminRole;
  /** True only for the development preview session. */
  isPreview: boolean;
}

const DEV_PREVIEW_SESSION: AdminSession = {
  userId: "dev-preview",
  email: "preview@localhost",
  role: "OWNER",
  isPreview: true,
};

export async function requireAdmin(): Promise<AdminSession> {
  if (process.env.NODE_ENV !== "production") return DEV_PREVIEW_SESSION;
  // No auth provider yet → closed. Do not reveal that the area exists.
  notFound();
}

/** Owner-only actions (approving quotations, orders, invoices…) must use this, not `requireAdmin()`. */
export async function requireOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "OWNER") notFound();
  return session;
}
