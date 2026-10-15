import "server-only";
import { randomBytes } from "node:crypto";
import { getServerEnv } from "@/lib/env";

/**
 * Supabase Storage over its plain REST API — no SDK, and the service-role key never leaves this server-only module.
 *
 * The bucket is PUBLIC for reading (product pictures are public on the website anyway) and has NO policies for browser
 * roles, so nobody can upload except this server with the service-role key.
 */
const DEFAULT_BUCKET = "product-images";
const TIMEOUT_MS = 15_000;

export interface StorageConfig {
  baseUrl: string; // https://xxxx.supabase.co (no trailing slash)
  key: string;
  bucket: string;
}

export function getStorageConfig(): StorageConfig | null {
  const env = getServerEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return { baseUrl: env.SUPABASE_URL.replace(/\/+$/, ""), key: env.SUPABASE_SERVICE_ROLE_KEY, bucket: env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET };
}

export const isStorageConfigured = () => getStorageConfig() !== null;

/** Hard-to-guess object path inside the bucket, so a replaced picture never serves a stale cached copy. */
export function newObjectPath(productId: string): string {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "product";
  return `products/${safeId}/${randomBytes(8).toString("hex")}.webp`;
}

export function publicUrlFor(config: StorageConfig, objectPath: string): string {
  return `${config.baseUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

const headers = (config: StorageConfig) => ({ Authorization: `Bearer ${config.key}`, apikey: config.key });
const objectEndpoint = (config: StorageConfig, objectPath: string) =>
  `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;

export class StorageError extends Error {}

export async function uploadObject(config: StorageConfig, objectPath: string, data: Buffer): Promise<void> {
  const response = await fetch(objectEndpoint(config, objectPath), {
    method: "POST",
    headers: { ...headers(config), "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "x-upsert": "false" },
    body: new Uint8Array(data),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new StorageError(`Storage upload failed with HTTP ${response.status}`);
}

/** Best effort: a leftover file is harmless, a failed delete must never block the admin. */
export async function deleteObject(config: StorageConfig, objectPath: string): Promise<boolean> {
  try {
    const response = await fetch(objectEndpoint(config, objectPath), { method: "DELETE", headers: headers(config), signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** The object path of one of OUR pictures, or null: never delete something just because a database column says so. */
export function ownObjectPath(objectPath: string | null | undefined): string | null {
  return objectPath && /^products\/[a-zA-Z0-9_-]{1,40}\/[a-f0-9]{16}\.webp$/.test(objectPath) ? objectPath : null;
}
