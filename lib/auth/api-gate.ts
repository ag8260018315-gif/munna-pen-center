import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

/**
 * The checks every admin route handler (/api/admin/*) makes before it reads a request body, in this order:
 *   1. same-origin request (a page on another site can not make an admin's browser POST here),
 *   2. the database is connected,
 *   3. a signed-in admin.
 * `proxy.ts` does not cover /api, so a route handler must never skip this. The data function it then calls still checks
 * requireAdmin() itself.
 */
export const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // browsers always send Origin on a cross-origin or form POST; refuse when it is missing
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** A response to send back if the request must be refused, or null if it may go on. */
export async function adminApiGate(request: Request): Promise<NextResponse | null> {
  if (!sameOrigin(request)) return json({ error: "Request refused." }, 403);
  if (!isDatabaseConfigured()) return json({ error: "The database is not connected." }, 503);
  if (!(await getAdminSession())) return json({ error: "Please sign in again." }, 401);
  return null;
}
