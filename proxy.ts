import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for /admin (the second is `requireAdmin()` in lib/auth/guard.ts).
 *
 * V1: no authentication provider is connected, so in production the admin area is closed —
 * requests are rewritten to a 404 so the area does not even reveal that it exists.
 * PHASE 2: allow the request through only when a valid session cookie is present, and let
 * `requireAdmin()` do the authoritative verification.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
