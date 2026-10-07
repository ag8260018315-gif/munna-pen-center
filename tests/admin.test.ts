import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECTIONS, adminHref, getAdminSection } from "@/lib/admin/sections";

describe("admin section registry", () => {
  it("lists every dashboard section the business asked for", () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual([
      "Dashboard",
      "Products",
      "Brands",
      "Categories",
      "Inventory",
      "Customers",
      "Leads",
      "Enquiries",
      "Quotes",
      "Orders",
      "Invoices",
      "Payments",
      "Follow-ups",
      "AI Sales Agent",
      "Settings",
    ]);
  });

  it("has unique slugs and routes the dashboard to /admin", () => {
    const slugs = ADMIN_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(adminHref({ slug: "dashboard" })).toBe("/admin");
    expect(adminHref({ slug: "ai-sales-agent" })).toBe("/admin/ai-sales-agent");
    expect(getAdminSection("nope")).toBeUndefined();
  });

  it("only references entities that exist in the Prisma schema (or are explicitly marked as to-be-added)", async () => {
    const { readFile } = await import("node:fs/promises");
    const schema = await readFile("prisma/schema.prisma", "utf8");
    const models = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
    for (const section of ADMIN_SECTIONS) {
      for (const entity of section.entities) {
        const name = entity.split(" ")[0]!;
        expect(models.has(name) || /to be added/.test(entity), `${section.label} → ${entity}`).toBe(true);
      }
    }
  });
});

describe("admin access guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("next/navigation");
  });

  async function loadGuard() {
    const notFound = vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    const redirect = vi.fn((to: string) => {
      throw new Error(`NEXT_REDIRECT:${to}`);
    });
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound, redirect }));
    vi.doMock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
    const guard = await import("@/lib/auth/guard");
    return { guard, notFound, redirect };
  }

  it("is CLOSED in production when no database is configured (404, nothing revealed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { guard } = await loadGuard();
    await expect(guard.requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(guard.requireOwner()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("returns a clearly-labelled preview session in development when no database is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    const { guard } = await loadGuard();
    await expect(guard.requireAdmin()).resolves.toMatchObject({ isPreview: true, role: "OWNER" });
  });
});

describe("proxy decision (first filter only)", () => {
  const base = { hasSessionCookie: false, databaseConfigured: true, production: true };

  it("keeps the area invisible in production when there is no database", async () => {
    const { decideAdminAccess } = await import("@/proxy");
    expect(decideAdminAccess({ ...base, pathname: "/admin", databaseConfigured: false })).toBe("not-found");
    expect(decideAdminAccess({ ...base, pathname: "/admin/login", databaseConfigured: false })).toBe("not-found");
  });

  it("sends strangers to the sign-in page, but lets them reach it", async () => {
    const { decideAdminAccess } = await import("@/proxy");
    expect(decideAdminAccess({ ...base, pathname: "/admin" })).toBe("login");
    expect(decideAdminAccess({ ...base, pathname: "/admin/products/new" })).toBe("login");
    expect(decideAdminAccess({ ...base, pathname: "/admin/login" })).toBe("next");
    expect(decideAdminAccess({ ...base, pathname: "/admin/setup/" })).toBe("next");
    expect(decideAdminAccess({ ...base, pathname: "/admin/login/../products" })).toBe("login");
  });

  it("lets a request with a session cookie through (requireAdmin() does the real check)", async () => {
    const { decideAdminAccess } = await import("@/proxy");
    expect(decideAdminAccess({ ...base, pathname: "/admin/products", hasSessionCookie: true })).toBe("next");
  });
});
