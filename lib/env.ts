import "server-only";
import { z } from "zod";

/**
 * Server-side environment variables — validated once, typed everywhere.
 *
 * Rules:
 *  • This module is `server-only`: importing it from a client component is a build error,
 *    so secrets can never leak into browser bundles.
 *  • Nothing here is a `NEXT_PUBLIC_*` variable. Anything prefixed NEXT_PUBLIC_ is public.
 *  • Every secret is optional in V1 because nothing consumes it yet. Mark the ones a
 *    feature needs as required when you build that feature.
 *  • Keep this schema and `.env.example` in sync (tests/env.test.ts checks it).
 */

/** 15 characters: 2-digit state code, 10-character PAN, entity number, "Z", check character. Checks the SHAPE only. */
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Treat `KEY=` (empty) the same as unset. */
const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());

const optionalGstin = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() || undefined : value),
  z.string().regex(GSTIN_PATTERN, "not a valid GSTIN").optional(),
);

export const serverEnvSchema = z.object({
  /** The business GSTIN (shown in the footer / About page when set; used on invoices in Phase 4). Never put it in source. */
  BUSINESS_GSTIN: optionalGstin,

  /** Where V1 stores enquiries (JSONL). Needs a persistent disk. */
  ENQUIRY_DATA_DIR: optionalString,

  /** Phase 2 — Supabase PostgreSQL. DATABASE_URL = pooled connection (app runtime on Vercel); DIRECT_URL = direct connection (migrations). */
  DATABASE_URL: optionalUrl,
  DIRECT_URL: optionalUrl,

  /** Phase 2 — Supabase project API + Storage (product images). The service-role key bypasses row security: server-only, never public. */
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: optionalString,

  /** Phase 2 — admin authentication. Generate with `openssl rand -base64 32`. */
  AUTH_SECRET: optionalString,

  /** Phase 3 — AI sales agent (LLM provider key). */
  AI_API_KEY: optionalString,

  /** Phase 3 — WhatsApp Business Platform (Cloud API). */
  WHATSAPP_API_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,

  /** Phase 4 — GST / e-invoice provider credentials. */
  GST_API_KEY: optionalString,
  GST_API_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  if (source === process.env && cached) return cached;

  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Report which variables are wrong — never their values.
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ");
    throw new Error(`Invalid environment configuration. Check: ${keys}`);
  }

  if (source === process.env) cached = result.data;
  return result.data;
}
