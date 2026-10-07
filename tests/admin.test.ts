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
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound }));
    const guard = await import("@/lib/auth/guard");
    return { guard, notFound };
  }

  it("is CLOSED in production: no auth provider is connected, so it 404s", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { guard, notFound } = await loadGuard();
    await expect(guard.requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(guard.requireOwner()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("returns a clearly-labelled preview session outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { guard } = await loadGuard();
    await expect(guard.requireAdmin()).resolves.toMatchObject({ isPreview: true, role: "OWNER" });
  });
});
