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

/**
 * Tidies a value typed into a hosting dashboard: surrounding spaces / newlines and one pair of matching quote marks
 * (a very common paste slip — Vercel keeps them, so `"postgresql://…"` would otherwise fail) are removed, and an empty
 * result counts as "not set". Anything else is left exactly as typed.
 */
function clean(value: unknown): unknown {
  if (typeof value !== "string") return value;
  let text = value.trim();
  const quote = text[0];
  if (text.length >= 2 && (quote === '"' || quote === "'" || quote === "`") && text.endsWith(quote)) text = text.slice(1, -1).trim();
  return text === "" ? undefined : text;
}

/** Treat `KEY=` (empty) the same as unset. */
const optionalString = z.preprocess(clean, z.string().min(1).optional());
const optionalUrl = z.preprocess(clean, z.url().optional());

/** `KEY=` (empty) = unset; otherwise one of the listed values. */
const optionalChoice = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(clean, z.enum(values).optional());

export const serverEnvSchema = z.object({
  /**
   * The business GSTIN (shown in the footer / About page when set; used on invoices in Phase 4). Never put it in source.
   * Deliberately NOT validated here: a mistyped value must not stop the build. lib/gstin.ts checks the shape where it is used.
   */
  BUSINESS_GSTIN: optionalString,

  /** Where V1 stores enquiries (JSONL). Needs a persistent disk. */
  ENQUIRY_DATA_DIR: optionalString,

  /**
   * Where the PUBLIC catalogue (categories, brands, products) is read from. Default "static" = the built-in lists in
   * data/. Switch to "database" only after the owner has loaded real products into the database — an empty database
   * would make the site look empty. (Enquiries do not use this: they go to the database whenever DATABASE_URL is set.)
   */
  CATALOGUE_SOURCE: optionalChoice(["static", "database"]),

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
