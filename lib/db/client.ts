import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

/**
 * The ONE place a database connection is made. Server-only: importing this from a client component is a build error,
 * so the connection string (a secret) can never reach the browser.
 *
 * `DATABASE_URL` is Supabase's POOLED connection string (migrations use `DIRECT_URL` instead, see prisma.config.ts).
 * On Vercel every function instance opens its own connections, so the pool per instance is kept tiny and the real
 * pooling is done by Supabase's pooler.
 */

const globalForDb = globalThis as unknown as { __munnaPrisma?: PrismaClient };

export function isDatabaseConfigured(): boolean {
  return Boolean(getServerEnv().DATABASE_URL);
}

export function getDb(): PrismaClient {
  const connectionString = getServerEnv().DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Cached on globalThis so `next dev` hot reloads do not open a new pool on every edit.
  globalForDb.__munnaPrisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3, connectionTimeoutMillis: 5_000 }) });
  return globalForDb.__munnaPrisma;
}
