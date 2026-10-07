import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { NewEnquiry } from "@/lib/domain/types";

/**
 * Integration tests for the database-backed repositories. They need a THROWAWAY PostgreSQL that already has migration
 * 0001 applied, given as TEST_DATABASE_URL (CI provides one). Without it they are skipped. They create only rows
 * marked "itest" and delete them afterwards. NEVER point TEST_DATABASE_URL at a real project.
 */
const url = process.env.TEST_DATABASE_URL;
const PRICE = "1234.56";
const SKU = "SKU-SECRET-9";

describe.skipIf(!url)("database repositories", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let catalogue: import("@/lib/repositories/prisma-catalogue").PrismaCatalogueRepository;
  let enquiries: import("@/lib/repositories/prisma-enquiries").PrismaEnquiryRepository;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    db = (await import("@/lib/db/client")).getDb();
    catalogue = new (await import("@/lib/repositories/prisma-catalogue")).PrismaCatalogueRepository();
    enquiries = new (await import("@/lib/repositories/prisma-enquiries")).PrismaEnquiryRepository();

    await db.category.createMany({
      data: [
        { id: "itest-cat", slug: "itest-glue", name: "ITest Glue", summary: "Glue for tests", sortOrder: 900 },
        { id: "itest-cat-off", slug: "itest-hidden", name: "ITest Hidden", isActive: false, sortOrder: 901 },
      ],
    });
    await db.brand.createMany({
      data: [
        { id: "itest-brand", slug: "itest-brand", name: "ITest Brand", isListedPublicly: true },
        { id: "itest-brand-private", slug: "itest-brand-private", name: "ITest Private Brand", isListedPublicly: false },
      ],
    });
    await db.product.createMany({
      data: [
        {
          id: "itest-p1", slug: "itest-glue-gun", name: "ITest Glue Gun", shortDescription: "A glue gun", categoryId: "itest-cat", brandId: "itest-brand",
          status: "ACTIVE", sku: SKU, purchasePrice: PRICE, wholesalePrice: PRICE, retailPrice: PRICE, stockQuantity: 777, hsnCode: "9999", gstRatePercent: "18", tags: ["itest"],
        },
        { id: "itest-p2", slug: "itest-draft", name: "ITest Draft", categoryId: "itest-cat", status: "DRAFT" },
        { id: "itest-p3", slug: "itest-inactive", name: "ITest Inactive", categoryId: "itest-cat", status: "INACTIVE" },
        { id: "itest-p4", slug: "itest-in-hidden-category", name: "ITest In Hidden Category", categoryId: "itest-cat-off", status: "ACTIVE" },
        { id: "itest-p5", slug: "itest-no-short", name: "ITest No Short", description: "Long text only", categoryId: "itest-cat", status: "ACTIVE" },
      ],
    });
  });

  afterAll(async () => {
    await db.enquiry.deleteMany({ where: { reference: { startsWith: "ENQ-" }, lead: { phone: { startsWith: "+9100000" } } } });
    await db.lead.deleteMany({ where: { phone: { startsWith: "+9100000" } } });
    await db.product.deleteMany({ where: { id: { startsWith: "itest-" } } });
    await db.brand.deleteMany({ where: { id: { startsWith: "itest-" } } });
    await db.category.deleteMany({ where: { id: { startsWith: "itest-" } } });
    await db.$disconnect();
  });

  describe("catalogue", () => {
    it("shows only active categories, listed brands and ACTIVE products", async () => {
      const categories = (await catalogue.listCategories()).map((c) => c.slug);
      expect(categories).toContain("itest-glue");
      expect(categories).not.toContain("itest-hidden");

      const brands = (await catalogue.listBrands()).map((b) => b.name);
      expect(brands).toContain("ITest Brand");
      expect(brands).not.toContain("ITest Private Brand");

      const slugs = (await catalogue.searchProducts({ query: "itest", pageSize: 60 })).items.map((p) => p.slug);
      expect(slugs).toContain("itest-glue-gun");
      for (const hidden of ["itest-draft", "itest-inactive", "itest-in-hidden-category"]) expect(slugs, hidden).not.toContain(hidden);
    });

    it("NEVER returns prices, SKU, stock, HSN or GST — anywhere in anything it returns", async () => {
      const everything = JSON.stringify([
        await catalogue.listCategories(),
        await catalogue.listBrands(),
        await catalogue.searchProducts({ pageSize: 60 }),
        await catalogue.getProductBySlug("itest-glue-gun"),
        await catalogue.listAllProducts(),
        await catalogue.listFeaturedProducts(),
      ]);
      expect(everything).toContain("itest-glue-gun"); // the product really was returned
      for (const secret of [PRICE, SKU, "777", "9999", "purchasePrice", "wholesalePrice", "retailPrice", "stockQuantity", "hsnCode", "gstRatePercent", "sku"]) {
        expect(everything, secret).not.toContain(secret);
      }
    });

    it("maps rows to the public product shape, with sensible fallbacks for empty optional columns", async () => {
      const product = await catalogue.getProductBySlug("itest-glue-gun");
      expect(product).toMatchObject({ id: "itest-p1", name: "ITest Glue Gun", shortDescription: "A glue gun", brandId: "itest-brand", status: "ACTIVE", category: { slug: "itest-glue" } });
      expect((await catalogue.getProductBySlug("itest-no-short"))?.shortDescription).toBe("Long text only");
      expect(await catalogue.getProductBySlug("itest-draft")).toBeNull();
      expect(await catalogue.getCategoryBySlug("itest-hidden")).toBeNull();
      expect((await catalogue.getCategoryBySlug("itest-glue"))?.seoTitle).toBe("Wholesale ITest Glue Supplier");
    });

    it("finds products by category and by search, like the built-in catalogue", async () => {
      expect((await catalogue.searchProducts({ categorySlug: "itest-glue", pageSize: 60 })).items.map((p) => p.slug).sort()).toEqual(["itest-glue-gun", "itest-no-short"]);
      expect((await catalogue.searchProducts({ query: "itest glue gun" })).items[0]?.slug).toBe("itest-glue-gun");
      expect((await catalogue.searchProducts({ query: "zzzzqqq" })).total).toBe(0);
    });
  });

  describe("enquiries", () => {
    const base = (over: Partial<NewEnquiry> = {}): NewEnquiry => ({
      source: "QUOTE_FORM", name: "Asha Kumari", organization: "Sunrise School", phone: "+910000011111", email: "asha@example.com", city: "Ranchi", state: "Jharkhand",
      productsRequired: "Glue Gun (10)", approximateQuantity: "10", items: [{ productId: "itest-p1", productName: "ITest Glue Gun", quantityNote: "10" }], ...over,
    });

    it("saves a lead, an enquiry and its lines together, and returns the customer-facing record", async () => {
      const saved = await enquiries.create(base());
      expect(saved.reference).toMatch(/^ENQ-\d{8}-[A-Z2-9]{4}$/);
      expect(saved).toMatchObject({ status: "NEW", name: "Asha Kumari", phone: "+910000011111", source: "QUOTE_FORM" });

      const row = await db.enquiry.findUniqueOrThrow({ where: { reference: saved.reference }, include: { lead: true, items: true } });
      expect(row.lead).toMatchObject({ name: "Asha Kumari", organizationName: "Sunrise School", source: "WEBSITE", status: "NEW" });
      expect(row.items).toMatchObject([{ productId: "itest-p1", productName: "ITest Glue Gun", quantityNote: "10" }]);
    });

    it("keeps the product NAME but drops a link to a product that does not exist in this database", async () => {
      const saved = await enquiries.create(base({ phone: "+910000022222", items: [{ productId: "glue-guns", productName: "Glue Guns", quantityNote: "5" }, { productId: null, productName: "Something else" }] }));
      const items = await db.enquiryItem.findMany({ where: { enquiry: { reference: saved.reference } }, orderBy: { productName: "asc" } });
      expect(items.map((i) => [i.productName, i.productId])).toEqual([["Glue Guns", null], ["Something else", null]]);
    });

    it("reuses a lead for the same phone and name (any letter case), but not for a different name", async () => {
      const phone = "+910000033333";
      const a = await enquiries.create(base({ phone, name: "Ravi Sinha" }));
      const b = await enquiries.create(base({ phone, name: "RAVI SINHA" }));
      const c = await enquiries.create(base({ phone, name: "Meena Devi" }));
      const leads = await db.lead.findMany({ where: { phone } });
      expect(leads).toHaveLength(2);
      const idOf = async (reference: string) => (await db.enquiry.findUniqueOrThrow({ where: { reference } })).leadId;
      expect(await idOf(a.reference)).toBe(await idOf(b.reference));
      expect(await idOf(c.reference)).not.toBe(await idOf(a.reference));
    });

    it("never modifies an existing lead (nobody can overwrite details by reusing a phone number)", async () => {
      const phone = "+910000044444";
      await enquiries.create(base({ phone, name: "Original Name", email: "original@example.com", organization: "Original Org" }));
      await enquiries.create(base({ phone, name: "original name", email: "attacker@example.com", organization: "Attacker Org" }));
      const lead = await db.lead.findFirstOrThrow({ where: { phone } });
      expect(lead).toMatchObject({ name: "Original Name", email: "original@example.com", organizationName: "Original Org" });
    });

    it("lists newest first with lead details and lines", async () => {
      const first = await enquiries.create(base({ phone: "+910000055555", name: "List One" }));
      const second = await enquiries.create(base({ phone: "+910000055555", name: "List One", items: [] }));
      const listed = (await enquiries.list({ limit: 50 })).filter((e) => [first.reference, second.reference].includes(e.reference));
      expect(listed.map((e) => e.reference)).toEqual([second.reference, first.reference]);
      expect(listed[1]).toMatchObject({ name: "List One", phone: "+910000055555", items: [{ productId: "itest-p1", productName: "ITest Glue Gun", quantityNote: "10" }] });
    });

    it("all-or-nothing: a record the database rejects leaves no lead and no enquiry behind", async () => {
      const { StorageUnavailableError } = await import("@/lib/repositories/types");
      const before = await db.lead.count({ where: { name: "Bad Phone" } });
      await expect(enquiries.create(base({ name: "Bad Phone", phone: "98765" }))).rejects.toBeInstanceOf(StorageUnavailableError);
      expect(await db.lead.count({ where: { name: "Bad Phone" } })).toBe(before);
    });
  });
});

describe.skipIf(!url)("seeding the owner-supplied catalogue", () => {
  it("loads exactly the supplied categories, brands and five products — nothing invented — and never overwrites", async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    const { getDb } = await import("@/lib/db/client");
    const { seedCatalogue } = await import("@/lib/db/seed-catalogue");
    const { categories } = await import("@/data/categories");
    const { brands } = await import("@/data/brands");
    const { products } = await import("@/data/products");
    const db = getDb();
    const slugs = { c: categories.map((c) => c.slug), b: brands.map((b) => b.slug), p: products.map((p) => p.slug) };
    const clean = async () => {
      await db.product.deleteMany({ where: { slug: { in: slugs.p } } });
      await db.brand.deleteMany({ where: { slug: { in: slugs.b } } });
      await db.category.deleteMany({ where: { slug: { in: slugs.c } } });
    };
    await clean();
    try {
      const first = await seedCatalogue(db);
      expect(first.created).toEqual({ categories: 23, brands: 20, products: 5 });

      const seeded = await db.product.findMany({ where: { slug: { in: slugs.p } } });
      expect(seeded).toHaveLength(5);
      for (const product of seeded) {
        expect(product, product.slug).toMatchObject({
          status: "ACTIVE", sku: null, unit: null, packSize: null, purchasePrice: null, wholesalePrice: null, retailPrice: null,
          hsnCode: null, gstRatePercent: null, stockQuantity: null, minOrderQuantity: null, brandId: null,
        });
      }
      expect(await db.brand.count({ where: { slug: { in: slugs.b } } })).toBe(20);
      expect((await db.brand.findMany({ where: { slug: { in: slugs.b } } })).every((b) => b.isListedPublicly)).toBe(true);

      // The owner edits a product; running the seed again must not undo that.
      await db.product.update({ where: { slug: "glue-guns" }, data: { name: "Owner's Own Name", wholesalePrice: "99.50" } });
      const second = await seedCatalogue(db);
      expect(second.created).toEqual({ categories: 0, brands: 0, products: 0 });
      expect(await db.product.findUniqueOrThrow({ where: { slug: "glue-guns" } })).toMatchObject({ name: "Owner's Own Name" });
      expect(await db.category.count({ where: { slug: { in: slugs.c } } })).toBe(23);
    } finally {
      await clean();
      await db.$disconnect();
    }
  });
});

describe.skipIf(!url)("the seed SQL that gets pasted into the Supabase SQL Editor", () => {
  it("really loads the owner-supplied catalogue, is repeatable, and never overwrites an edit", async () => {
    const { Client } = await import("pg");
    const { readFile } = await import("node:fs/promises");
    const sql = await readFile("prisma/seed/catalogue.sql", "utf8");
    const { categories } = await import("@/data/categories");
    const { brands } = await import("@/data/brands");
    const { products } = await import("@/data/products");

    const client = new Client({ connectionString: url });
    await client.connect();
    const clean = async () => {
      await client.query(`DELETE FROM "Product" WHERE slug = ANY($1)`, [products.map((p) => p.slug)]);
      await client.query(`DELETE FROM "Brand" WHERE slug = ANY($1)`, [brands.map((b) => b.slug)]);
      await client.query(`DELETE FROM "Category" WHERE slug = ANY($1)`, [categories.map((c) => c.slug)]);
    };
    await clean();
    try {
      await client.query(sql); // the whole file, exactly as the SQL Editor would run it
      const count = async (table: string, slugs: string[]) => Number((await client.query(`SELECT count(*) FROM "${table}" WHERE slug = ANY($1)`, [slugs])).rows[0].count);
      expect(await count("Category", categories.map((c) => c.slug))).toBe(categories.length);
      expect(await count("Brand", brands.map((b) => b.slug))).toBe(brands.length);
      expect(await count("Product", products.map((p) => p.slug))).toBe(products.length);

      const product = (await client.query(`SELECT p.*, c.slug AS category_slug FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" WHERE p.slug = 'glue-guns'`)).rows[0];
      expect(product).toMatchObject({ name: "Glue Guns", status: "ACTIVE", category_slug: "glue-guns", sku: null, purchasePrice: null, wholesalePrice: null, retailPrice: null, hsnCode: null, gstRatePercent: null, stockQuantity: null, brandId: null });
      expect((await client.query(`SELECT count(*) FROM "Brand" WHERE slug = ANY($1) AND "isListedPublicly"`, [brands.map((b) => b.slug)])).rows[0].count).toBe(String(brands.length));

      await client.query(`UPDATE "Product" SET name = 'Owner Edit' WHERE slug = 'glue-guns'`);
      await client.query(sql); // run it again
      expect((await client.query(`SELECT name FROM "Product" WHERE slug = 'glue-guns'`)).rows[0].name).toBe("Owner Edit");
      expect(await count("Category", categories.map((c) => c.slug))).toBe(categories.length);
    } finally {
      await clean();
      await client.end();
    }
  });
});

describe("the public catalogue queries never ask for private columns", () => {
  it("prisma-catalogue.ts selects explicit public columns and never names a price, SKU, stock or tax column", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("lib/repositories/prisma-catalogue.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/select:\s*\{/);
    expect((code.match(/\.findMany\(/g) ?? []).length).toBe((code.match(/select:\s*\{/g) ?? []).length); // every query has a select
    for (const column of ["purchasePrice", "wholesalePrice", "retailPrice", "sku", "stockQuantity", "hsnCode", "gstRatePercent", "minOrderQuantity"]) {
      expect(code, column).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });
});
