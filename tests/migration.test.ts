import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Offline guards on the first migration (prisma/migrations/0001_init). The behavioural proof — that the rules
 * really hold on PostgreSQL — is prisma/tests/migration-checks.sql, which CI runs against a throwaway database.
 */
let sql = "";
let schema = "";

beforeAll(async () => {
  sql = await readFile("prisma/migrations/0001_init/migration.sql", "utf8");
  schema = await readFile("prisma/schema.prisma", "utf8");
});

describe("migration 0001_init", () => {
  it("creates exactly the tables the schema defines (Prisma-generated part is not stale)", () => {
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]).sort();
    const tables = [...sql.matchAll(/^CREATE TABLE "(\w+)"/gm)].map((m) => m[1]).sort();
    expect(models.length).toBeGreaterThan(15);
    expect(tables).toEqual(models);
  });

  it("covers every table the owner asked for", () => {
    for (const table of ["Brand", "Category", "Product", "Customer", "Lead", "Enquiry", "Quotation", "Order", "Invoice", "Payment", "FollowUp", "AdminUser", "AdminSession"]) {
      expect(sql, table).toMatch(new RegExp(`CREATE TABLE "${table}"`));
    }
  });

  it("inserts no data at all — no products, prices, customers or users", () => {
    expect(sql).not.toMatch(/^\s*INSERT\s+INTO/im);
    expect(sql).not.toMatch(/^\s*COPY\s/im);
  });

  it("contains no secrets, connection strings or GSTIN-shaped values", () => {
    expect(sql).not.toMatch(/postgres(ql)?:\/\//i);
    expect(sql).not.toMatch(/service_role|eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
  });

  it("turns on row level security for every table and denies the Supabase API roles outright", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/FOR tablename IN|SELECT tablename FROM pg_tables WHERE schemaname = 'public'/);
    expect(sql).toMatch(/CREATE POLICY "deny_api_access"[^;]*AS RESTRICTIVE[^;]*TO anon, authenticated[^;]*USING \(false\)[^;]*WITH CHECK \(false\)/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/);
    // No permissive policy, and nothing is ever granted to the browser-facing roles.
    expect(sql).not.toMatch(/AS PERMISSIVE/i);
    expect(sql).not.toMatch(/GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*\bTO\b[^;]*\b(anon|authenticated|PUBLIC)\b/i);
  });

  it("every foreign key states what happens on delete and update", () => {
    const fks = [...sql.matchAll(/FOREIGN KEY[^;]*;/g)].map((m) => m[0]);
    expect(fks.length).toBeGreaterThan(30);
    for (const fk of fks) expect(fk).toMatch(/ON DELETE (RESTRICT|CASCADE|SET NULL) ON UPDATE (CASCADE|RESTRICT)/);
  });

  it("every trigger function pins its search_path", () => {
    const functions = [...sql.matchAll(/CREATE FUNCTION[^$]*\$\$/g)].map((m) => m[0]);
    expect(functions.length).toBeGreaterThanOrEqual(8);
    for (const fn of functions) expect(fn).toMatch(/SET search_path = public, pg_temp/);
  });

  it("the behavioural check script and its CI step exist and use a throwaway database only", async () => {
    const checks = await readFile("prisma/tests/migration-checks.sql", "utf8");
    expect(checks).toMatch(/^BEGIN;/m);
    expect(checks).toMatch(/^ROLLBACK;/m);
    const ci = await readFile(".github/workflows/ci.yml", "utf8");
    expect(ci).toMatch(/services:\s*\n\s*postgres:/);
    expect(ci).toMatch(/migration-checks\.sql/);
    expect(ci).not.toMatch(/supabase\.co/);
  });
});

describe("the Supabase setup guide", () => {
  it("names the three files it tells the owner to paste, and they exist", async () => {
    const { access } = await import("node:fs/promises");
    const guide = await readFile("docs/SUPABASE_SETUP.md", "utf8");
    for (const file of ["prisma/migrations/0001_init/migration.sql", "prisma/tests/migration-checks.sql", "prisma/seed/catalogue.sql"]) {
      expect(guide, file).toContain(file);
      await expect(access(file)).resolves.toBeUndefined();
    }
    // It never asks the owner to hand over a secret.
    expect(guide).toMatch(/never ask you for the database password/i);
    expect(guide).not.toMatch(/postgres(ql)?:\/\/[^\s`]*:[^\s`\[]+@/); // no filled-in connection string
  });
});

describe("the files pasted into the Supabase SQL Editor", () => {
  const files = ["prisma/migrations/0001_init/migration.sql", "prisma/tests/migration-checks.sql", "prisma/seed/catalogue.sql"];

  it("are pure ASCII — an em dash or other symbol can be mangled by a browser editor's own script rewriting", async () => {
    for (const file of files) {
      const text = await readFile(file, "utf8");
      const bad = [...text].filter((character) => (character.codePointAt(0) ?? 0) > 126).slice(0, 5);
      expect(bad, file).toEqual([]);
    }
  });

  it("switch row level security on for every table with a plain, visible statement (so the editor adds nothing of its own)", () => {
    const tables = [...sql.matchAll(/^CREATE TABLE "(\w+)"/gm)].map((m) => m[1]);
    expect(tables.length).toBe(19);
    for (const table of tables) expect(sql, table).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
  });
});
