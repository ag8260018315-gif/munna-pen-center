import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { productSchema, slugify, brandSchema } from "@/lib/validation/admin-catalogue";

describe("admin data functions are all behind requireAdmin()", () => {
  it("every exported function in lib/admin/*.ts calls requireAdmin() (or requireOwner()) before touching data", async () => {
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir("lib/admin")).filter((f) => f.endsWith(".ts") && f !== "sections.ts");
    expect(files).toContain("catalogue-admin.ts");
    for (const file of files) {
      const source = await readFile(`lib/admin/${file}`, "utf8");
      const parts = source.split(/^export async function /m).slice(1);
      expect(parts.length, file).toBeGreaterThan(5);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("("));
        const firstLines = part.split("\n").slice(0, 4).join("\n");
        expect(/await require(Admin|Owner)\(\)/.test(firstLines), `${file}: ${name}() must call requireAdmin() first`).toBe(true);
      }
      // No non-async exported function can read data around the guard.
      expect(source, file).not.toMatch(/^export (const|function) \w+\s*=?\s*(async )?\(?.*getDb/m);
    }
  });

  it("the data layer is server-only and uses no client import", async () => {
    const source = await readFile("lib/admin/catalogue-admin.ts", "utf8");
    expect(source.startsWith('import "server-only"')).toBe(true);
    expect(source).not.toContain('"use client"');
  });
});

describe("product validation", () => {
  const base = { name: "Blue Pen", categoryId: "c1", status: "DRAFT" };
  const parse = (extra: Record<string, string> = {}) => productSchema.safeParse({ ...base, ...extra });

  it("treats blank business fields as null, never as 0 or a default", () => {
    const r = parse({ sku: "", wholesalePrice: " ", stockQuantity: "", gstRatePercent: "", hsnCode: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ sku: null, wholesalePrice: null, purchasePrice: null, retailPrice: null, stockQuantity: null, minOrderQuantity: null, gstRatePercent: null, hsnCode: null, brandId: null, slug: null });
    expect(r.data.isFeatured).toBe(false);
  });

  it("accepts good values and rejects bad ones", () => {
    expect(parse({ wholesalePrice: "₹1,250.50", stockQuantity: "0", gstRatePercent: "18", hsnCode: "9608", minOrderQuantity: "12" })).toMatchObject({ success: true, data: { wholesalePrice: "1250.50", stockQuantity: 0, minOrderQuantity: 12 } });
    const badInputs: Record<string, string>[] = [{ wholesalePrice: "-5" }, { wholesalePrice: "12.345" }, { wholesalePrice: "abc" }, { stockQuantity: "-1" }, { stockQuantity: "1.5" }, { stockQuantity: "99999999999" }, { gstRatePercent: "101" }, { gstRatePercent: "x" }, { hsnCode: "12" }, { minOrderQuantity: "0" }, { slug: "Bad Slug" }, { slug: "-a" }, { status: "DELETED" }, { name: "x" }];
    for (const bad of badInputs) {
      expect(parse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("splits tags and ignores unknown fields", () => {
    const r = parse({ tags: " Pen, Blue ,,gel ", evil: "x", id: "hack", createdAt: "2000-01-01" });
    expect(r.success && r.data.tags).toEqual(["pen", "blue", "gel"]);
    expect(r.success && Object.keys(r.data)).not.toContain("evil");
    expect(r.success && Object.keys(r.data)).not.toContain("id");
  });

  it("makes safe slugs", () => {
    expect(slugify("Cello & Adhesive Tape (Brown)")).toBe("cello-and-adhesive-tape-brown");
    expect(slugify("  --Pens!!  ")).toBe("pens");
    expect(slugify("पेन")).toBe("");
    expect(brandSchema.safeParse({ name: "DOMS", isListedPublicly: "on" })).toMatchObject({ success: true, data: { isListedPublicly: true, isActive: false, sortOrder: 0 } });
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("admin catalogue on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let admin: typeof import("@/lib/admin/catalogue-admin");
  let role: "OWNER" | "STAFF" = "OWNER";
  let signedIn = true;
  const revalidate = vi.fn();
  let catId = "";
  let brandId = "";

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: revalidate }));
    vi.doMock("@/lib/auth/guard", () => ({
      requireAdmin: async () => {
        if (!signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
        return { userId: "u", email: "t@example.test", name: "T", role, isPreview: false };
      },
    }));
    db = (await import("@/lib/db/client")).getDb();
    admin = await import("@/lib/admin/catalogue-admin");
    catId = (await db.category.create({ data: { id: "itest-acat", slug: "itest-acat", name: "ITest ACat" } })).id;
    brandId = (await db.brand.create({ data: { id: "itest-abrand", slug: "itest-abrand", name: "ITest ABrand" } })).id;
  });
  afterAll(async () => {
    await db.product.deleteMany({ where: { slug: { startsWith: "itest-a" } } });
    await db.brand.deleteMany({ where: { OR: [{ id: { startsWith: "itest-a" } }, { slug: { startsWith: "itest-a" } }] } });
    await db.category.deleteMany({ where: { OR: [{ id: { startsWith: "itest-a" } }, { slug: { startsWith: "itest-a" } }] } });
    await db.$disconnect();
  });
  beforeEach(async () => {
    role = "OWNER";
    signedIn = true;
    revalidate.mockClear();
    await db.product.deleteMany({ where: { slug: { startsWith: "itest-a" } } });
  });

  const form = (extra: Record<string, string> = {}) => ({ name: "ITest A Pen", slug: "itest-a-pen", categoryId: catId, status: "DRAFT", ...extra });

  it("refuses everything when nobody is signed in", async () => {
    signedIn = false;
    await expect(admin.createProduct(form())).rejects.toThrow("NEXT_REDIRECT");
    await expect(admin.listProducts({})).rejects.toThrow("NEXT_REDIRECT");
    await expect(admin.updateStock("x", { stockQuantity: "5" })).rejects.toThrow("NEXT_REDIRECT");
    await expect(admin.getDashboardCounts()).rejects.toThrow("NEXT_REDIRECT");
    await expect(admin.listEnquiries({})).rejects.toThrow("NEXT_REDIRECT");
    expect(await db.product.count({ where: { slug: "itest-a-pen" } })).toBe(0);
  });

  it("creates a product with only what was typed — everything else is NULL — and refreshes the site", async () => {
    const r = await admin.createProduct(form());
    expect(r.ok).toBe(true);
    const row = await db.product.findUniqueOrThrow({ where: { slug: "itest-a-pen" } });
    expect(row).toMatchObject({ status: "DRAFT", sku: null, purchasePrice: null, wholesalePrice: null, retailPrice: null, stockQuantity: null, minOrderQuantity: null, hsnCode: null, gstRatePercent: null, brandId: null, isFeatured: false });
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("stores prices, stock, GST and HSN exactly, and reads them back for editing", async () => {
    const r = await admin.createProduct(form({ sku: "SKU-1", brandId, purchasePrice: "10.5", wholesalePrice: "12", retailPrice: "15.25", gstRatePercent: "12", hsnCode: "9608", stockQuantity: "40", minOrderQuantity: "6", tags: "a, b" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = await admin.getProductForEdit(r.id);
    expect(p).toMatchObject({ sku: "SKU-1", purchasePrice: "10.5", wholesalePrice: "12", retailPrice: "15.25", gstRatePercent: "12", hsnCode: "9608", stockQuantity: 40, minOrderQuantity: 6, tags: ["a", "b"], brandId });
  });

  it("reports duplicate slug and duplicate SKU as field errors, not crashes", async () => {
    await admin.createProduct(form({ sku: "SKU-D" }));
    const dupSlug = await admin.createProduct(form());
    expect(dupSlug).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    const dupSku = await admin.createProduct(form({ slug: "itest-a-other", sku: "SKU-D" }));
    expect(dupSku).toMatchObject({ ok: false, fieldErrors: { sku: expect.any(String) } });
  });

  it("rejects an unknown category or brand, and invalid numbers, without writing", async () => {
    expect(await admin.createProduct(form({ categoryId: "nope" }))).toMatchObject({ ok: false });
    expect(await admin.createProduct(form({ brandId: "nope" }))).toMatchObject({ ok: false });
    expect(await admin.createProduct(form({ wholesalePrice: "-1" }))).toMatchObject({ ok: false });
    expect(await db.product.count({ where: { slug: "itest-a-pen" } })).toBe(0);
  });

  it("STAFF can add products and edit them but can not enter or change prices, GST or HSN", async () => {
    role = "STAFF";
    expect(await admin.createProduct(form({ wholesalePrice: "5" }))).toMatchObject({ ok: false });
    const made = await admin.createProduct(form());
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(await admin.updateProduct(made.id, form({ name: "ITest A Pen v2" }))).toMatchObject({ ok: true });
    expect(await admin.updateProduct(made.id, form({ retailPrice: "9" }))).toMatchObject({ ok: false });
    expect(await admin.updateProduct(made.id, form({ hsnCode: "9608" }))).toMatchObject({ ok: false });
    role = "OWNER";
    await admin.updateProduct(made.id, form({ retailPrice: "9.00", hsnCode: "9608", gstRatePercent: "12" }));
    role = "STAFF";
    // a staff browser does not send the disabled price boxes: the stored values must survive an edit
    expect(await admin.updateProduct(made.id, form({ name: "ITest A Pen v3" }))).toMatchObject({ ok: true });
    expect(await db.product.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ name: "ITest A Pen v3", hsnCode: "9608" });
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).retailPrice?.toString()).toBe("9");
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).gstRatePercent?.toString()).toBe("12");
    // same value written differently is not a change
    expect(await admin.updateProduct(made.id, form({ name: "ITest A Pen", retailPrice: "9", hsnCode: "9608", gstRatePercent: "12" }))).toMatchObject({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).name).toBe("ITest A Pen");
  });

  it("deactivating keeps the row; status and stock updates work; unknown ids are handled", async () => {
    const made = await admin.createProduct(form({ stockQuantity: "3" }));
    if (!made.ok) throw new Error("setup");
    expect(await admin.setProductStatus(made.id, "INACTIVE")).toMatchObject({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).status).toBe("INACTIVE");
    expect(await admin.updateStock(made.id, { stockQuantity: "0" })).toMatchObject({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).stockQuantity).toBe(0);
    expect(await admin.updateStock(made.id, { stockQuantity: "" })).toMatchObject({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: made.id } })).stockQuantity).toBeNull();
    expect(await admin.updateStock(made.id, { stockQuantity: "-4" })).toMatchObject({ ok: false });
    expect(await admin.setProductStatus("missing", "ACTIVE")).toMatchObject({ ok: false });
    expect(await admin.setProductStatus(made.id, "BOGUS" as never)).toMatchObject({ ok: false });
    expect(await admin.updateStock("missing", { stockQuantity: "1" })).toMatchObject({ ok: false });
  });

  it("lists with search, status filter and paging", async () => {
    await admin.createProduct(form({ name: "ITest A Alpha", slug: "itest-a-alpha", status: "ACTIVE" }));
    await admin.createProduct(form({ name: "ITest A Beta", slug: "itest-a-beta", sku: "ZZ-FIND-ME" }));
    expect((await admin.listProducts({ q: "alpha" })).items.map((i) => i.slug)).toContain("itest-a-alpha");
    expect((await admin.listProducts({ q: "zz-find" })).items.map((i) => i.slug)).toEqual(["itest-a-beta"]);
    const active = await admin.listProducts({ q: "itest a", status: "ACTIVE" });
    expect(active.items.every((i) => i.status === "ACTIVE")).toBe(true);
    expect((await admin.listProducts({ page: -3 })).page).toBe(1);
    expect((await admin.listProducts({ q: "'; DROP TABLE \"Product\"; --" })).items).toEqual([]);
  });

  it("brands and categories: create, edit, deactivate, and duplicate handling", async () => {
    const b = await admin.saveBrand(null, { name: "ITest A Brand Two", isListedPublicly: "on", isActive: "on" });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(await db.brand.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ slug: "itest-a-brand-two", isListedPublicly: true, isActive: true });
    expect(await admin.saveBrand(null, { name: "itest a brand two", slug: "itest-a-brand-3" })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(await admin.saveBrand(b.id, { name: "ITest A Brand Two", slug: "itest-a-brand-two" })).toMatchObject({ ok: true });
    expect((await db.brand.findUniqueOrThrow({ where: { id: b.id } })).isActive).toBe(false); // unticked = deactivated
    // slug left blank: the clash is reported on the NAME box the person actually typed in
    expect(await admin.saveBrand(null, { name: "ITEST A BRAND TWO" })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(await admin.saveBrand("missing", { name: "Whatever" })).toMatchObject({ ok: false });

    const c = await admin.saveCategory(null, { name: "ITest A Cat Two", summary: "", isActive: "on" });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(await db.category.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ slug: "itest-a-cat-two", summary: null });
    expect(await admin.saveCategory(null, { name: "Another", slug: "itest-a-cat-two" })).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    await db.category.delete({ where: { id: c.id } });
    await db.brand.delete({ where: { id: b.id } });
  });

  it("dashboard counts and enquiry listing work on an empty or populated database", async () => {
    const counts = await admin.getDashboardCounts();
    expect(Object.values(counts).every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    const list = await admin.listEnquiries({ status: "NEW", page: 1 });
    expect(list.items.every((e) => e.status === "NEW")).toBe(true);
    expect(await admin.getEnquiry("missing")).toBeNull();
  });
});
