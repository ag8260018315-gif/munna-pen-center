import { NextResponse, type NextRequest } from "next/server";

/**
 * First filter for /admin. The authoritative check is `requireAdmin()` (lib/auth/guard.ts) — this only keeps obvious
 * strangers away early and keeps the area invisible when it is not configured.
 *
 * Kept free of Node-only and database code on purpose.
 */
export type ProxyDecision = "next" | "login" | "not-found";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/setup"]);

export function decideAdminAccess(input: { pathname: string; hasSessionCookie: boolean; databaseConfigured: boolean; production: boolean }): ProxyDecision {
  // Without a database there is nothing to sign in to. In production the area stays closed.
  if (!input.databaseConfigured) return input.production ? "not-found" : "next";
  if (PUBLIC_ADMIN_PATHS.has(input.pathname.replace(/\/$/, ""))) return "next";
  return input.hasSessionCookie ? "next" : "login";
}

export function proxy(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const cookieName = production ? "__Host-mpc_admin" : "mpc_admin";
  const decision = decideAdminAccess({
    pathname: request.nextUrl.pathname,
    hasSessionCookie: Boolean(request.cookies.get(cookieName)?.value),
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    production,
  });
  if (decision === "not-found") return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  if (decision === "login") return NextResponse.redirect(new URL("/admin/login", request.url));
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
