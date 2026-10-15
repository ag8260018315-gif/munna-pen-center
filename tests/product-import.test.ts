import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

const HEADER = "name,category,brand,short_description,unit,pack_size,sku,stock,status,wholesale_price,gst_percent,hsn_code,tags,featured,slug";

describe.skipIf(!url)("products spreadsheet import on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let imp: typeof import("@/lib/admin/product-import");
  let role: "OWNER" | "STAFF" = "OWNER";
  let signedIn = true;
  const P = "imptest-";

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/lib/auth/guard", () => ({
      requireAdmin: async () => {
        if (!signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
        return { userId: "u", email: "t@example.test", name: "T", role, isPreview: false };
      },
    }));
    db = (await import("@/lib/db/client")).getDb();
    imp = await import("@/lib/admin/product-import");
    await cleanup();
    await db.category.createMany({ data: [{ id: `${P}c1`, slug: `${P}pens`, name: "ImpTest Pens" }, { id: `${P}c2`, slug: `${P}paper`, name: "ImpTest Paper" }] });
    await db.brand.create({ data: { id: `${P}b1`, slug: `${P}acme`, name: "ImpTest Acme" } });
  });
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });
  async function cleanup() {
    await db.product.deleteMany({ where: { OR: [{ slug: { startsWith: P } }, { sku: { startsWith: "IMP-" } }, { categoryId: { startsWith: P } }] } });
    await db.brand.deleteMany({ where: { id: { startsWith: P } } });
    await db.category.deleteMany({ where: { id: { startsWith: P } } });
  }
  beforeEach(async () => {
    role = "OWNER";
    signedIn = true;
    await db.product.deleteMany({ where: { OR: [{ slug: { startsWith: P } }, { sku: { startsWith: "IMP-" } }] } });
  });

  const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
  const count = () => db.product.count({ where: { OR: [{ slug: { startsWith: P } }, { sku: { startsWith: "IMP-" } }] } });

  it("refuses everyone who is not signed in", async () => {
    signedIn = false;
    await expect(imp.previewProductImport(csv("A,ImpTest Pens"))).rejects.toThrow("NEXT_REDIRECT");
    await expect(imp.importProducts(csv("A,ImpTest Pens"))).rejects.toThrow("NEXT_REDIRECT");
  });

  it("previews without writing, then imports every row, leaving blanks as NULL", async () => {
    const file = csv(
      `${P}Blue Pen,ImpTest Pens,ImpTest Acme,A blue pen,box,Box of 10,IMP-1,40,ACTIVE,12.50,12,9608,"pen, blue",yes,${P}blue-pen`,
      `${P}Notebook,${P}paper,,,,,,,,,,,,,`,
    );
    const preview = await imp.previewProductImport(file);
    expect(preview).toMatchObject({ ok: true, total: 2 });
    expect(await count()).toBe(0);

    expect(await imp.importProducts(file)).toEqual({ ok: true, created: 2 });
    const pen = await db.product.findUniqueOrThrow({ where: { slug: `${P}blue-pen` } });
    expect(pen).toMatchObject({ name: `${P}Blue Pen`, categoryId: `${P}c1`, brandId: `${P}b1`, status: "ACTIVE", sku: "IMP-1", stockQuantity: 40, hsnCode: "9608", isFeatured: true, tags: ["pen", "blue"], unit: "box", packSize: "Box of 10" });
    expect(pen.wholesalePrice?.toString()).toBe("12.5");
    expect(pen.gstRatePercent?.toString()).toBe("12");
    const book = await db.product.findFirstOrThrow({ where: { name: `${P}Notebook` } });
    expect(book).toMatchObject({ status: "DRAFT", brandId: null, sku: null, stockQuantity: null, wholesalePrice: null, retailPrice: null, purchasePrice: null, gstRatePercent: null, hsnCode: null, minOrderQuantity: null, isFeatured: false, shortDescription: null });
    expect(book.slug).toBe(`${P}notebook`); // made from the name
  });

  it("is all-or-nothing and lists every problem with its spreadsheet line number", async () => {
    const file = csv(
      `${P}Good,ImpTest Pens`,
      `${P}Bad Category,Nonexistent`,
      `${P}Bad Brand,ImpTest Pens,Nobody`,
      `${P}Bad Price,ImpTest Pens,,,,,,,,abc`,
      `${P}Bad Status,ImpTest Pens,,,,,,,SOLD`,
      `x,ImpTest Pens`,
      `${P}Neg Stock,ImpTest Pens,,,,,,-5`,
    );
    const result = await imp.importProducts(file);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const byLine = Object.fromEntries(result.problems.map((p) => [p.line, p.messages.join(" ")]));
    expect(Object.keys(byLine).map(Number)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(byLine[3]).toMatch(/Category “Nonexistent” does not exist/);
    expect(byLine[4]).toMatch(/Brand “Nobody” does not exist/);
    expect(byLine[5]).toMatch(/Wholesale price/);
    expect(byLine[6]).toMatch(/Status must be/);
    expect(byLine[7]).toMatch(/Name/);
    expect(byLine[8]).toMatch(/Stock/);
    expect(await count()).toBe(0); // even the good row was not imported
  });

  it("makes unique web addresses for repeated names, and refuses clashes on an explicit address or a SKU", async () => {
    await db.product.create({ data: { slug: `${P}pen`, name: "Existing", categoryId: `${P}c1`, sku: "IMP-EXISTING" } });
    const ok = await imp.importProducts(csv(`${P}Pen,ImpTest Pens`, `${P}Pen,ImpTest Pens`, `${P}Pen,ImpTest Pens`));
    expect(ok).toEqual({ ok: true, created: 3 });
    const slugs = (await db.product.findMany({ where: { slug: { startsWith: `${P}pen` } }, orderBy: { slug: "asc" } })).map((p) => p.slug);
    expect(slugs).toEqual([`${P}pen`, `${P}pen-2`, `${P}pen-3`, `${P}pen-4`]);

    const clash = await imp.importProducts(csv(`A Name,ImpTest Pens,,,,,IMP-EXISTING`, `Other,ImpTest Pens,,,,,IMP-NEW`, `Third,ImpTest Pens,,,,,IMP-NEW`, `Fourth,ImpTest Pens,,,,,,,,,,,,,${P}pen`));
    expect(clash.ok).toBe(false);
    if (clash.ok) return;
    const messages = clash.problems.map((p) => `${p.line}: ${p.messages.join(" ")}`).join("\n");
    expect(messages).toMatch(/2: .*IMP-EXISTING.*already used/);
    expect(messages).toMatch(/4: .*IMP-NEW.*in this file/);
    expect(messages).toMatch(/5: .*imptest-pen.*already used/);
    expect(await db.product.count({ where: { sku: "IMP-NEW" } })).toBe(0);
  });

  it("lists a clash and another mistake in the same row together, so one pass shows everything to fix", async () => {
    const result = await imp.previewProductImport(csv(`${P}First,ImpTest Pens,,,,,IMP-DUP`, `${P}Second,ImpTest Pens,,,,,IMP-DUP,,,,abc`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.line).toBe(3);
    expect(result.problems[0]!.messages.join(" ")).toMatch(/IMP-DUP.*in this file/);
    expect(result.problems[0]!.messages.join(" ")).toMatch(/GST percent/);
  });

  it("STAFF can import products but not prices, GST or HSN", async () => {
    role = "STAFF";
    const refused = await imp.importProducts(csv(`${P}Staff Pen,ImpTest Pens,,,,,,,,10`, `${P}Staff Pen 2,ImpTest Pens,,,,,,,,,18`));
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.problems.map((p) => p.line)).toEqual([2, 3]);
    expect(refused.problems[0]!.messages.join(" ")).toMatch(/Only the owner can import wholesale price/);
    expect(await count()).toBe(0);
    expect(await imp.importProducts(csv(`${P}Staff Pen,ImpTest Pens,,,box,,,25`))).toEqual({ ok: true, created: 1 });
  });

  it("rejects a bad file as a whole: unknown or repeated columns, missing columns, empty, no rows, too many rows, semicolons, open quote", async () => {
    const cases: [string, RegExp][] = [
      ["name,category,wholesale_prise\nA,ImpTest Pens,5", /Unknown column.*wholesale_prise/],
      ["name,category,name\nA,ImpTest Pens,B", /appears twice/],
      ["name,brand\nA,", /“category” column is missing/],
      ["", /empty/],
      ["name,category\n", /no products/],
      ["name;category\nA;ImpTest Pens", /semicolons/],
      ['name,category\n"A,ImpTest Pens', /never closed/],
      [`name,category\n${Array.from({ length: imp.MAX_IMPORT_ROWS + 1 }, () => "A,ImpTest Pens").join("\n")}`, /At most 300/],
    ];
    for (const [file, pattern] of cases) {
      const result = await imp.previewProductImport(file);
      expect(result.ok, file.slice(0, 30)).toBe(false);
      if (!result.ok) expect(result.fileError ?? "", file.slice(0, 30)).toMatch(pattern);
    }
    expect(await count()).toBe(0);
  });

  it("accepts friendly header spellings (Excel style, aliases) and a leading byte-order mark", async () => {
    const file = `﻿Product Name,Category,Pack Size,GST,HSN,Stock Quantity,Featured\n${P}Alias Pen,ImpTest Pens,Box of 5,18,9608,7,TRUE\n`;
    expect(await imp.importProducts(file)).toEqual({ ok: true, created: 1 });
    expect(await db.product.findFirstOrThrow({ where: { name: `${P}Alias Pen` } })).toMatchObject({ packSize: "Box of 5", hsnCode: "9608", stockQuantity: 7, isFeatured: true });
  });

  it("can not be tricked by formulas, HTML or SQL in cells: they are stored as plain text", async () => {
    const evil = `=HYPERLINK(""http://evil"")`;
    expect(await imp.importProducts(csv(`"${P}${evil}",ImpTest Pens,,"<script>alert(1)</script>"`))).toMatchObject({ ok: true });
    const p = await db.product.findFirstOrThrow({ where: { shortDescription: "<script>alert(1)</script>" } });
    expect(p.name).toContain("=HYPERLINK");
    await db.product.delete({ where: { id: p.id } });
    expect(await imp.importProducts(csv(`${P}'); DROP TABLE "Product"; --,ImpTest Pens`))).toMatchObject({ ok: true });
    expect(await db.product.count({ where: { name: { contains: "DROP TABLE" } } })).toBe(1);
  });

  it("shows at most 50 preview rows but reports the full total", async () => {
    const rows = Array.from({ length: 80 }, (_, i) => `${P}Bulk ${i},ImpTest Pens`);
    const preview = await imp.previewProductImport(csv(...rows));
    expect(preview).toMatchObject({ ok: true, total: 80 });
    if (preview.ok) expect(preview.rows).toHaveLength(50);
    expect(await imp.importProducts(csv(...rows))).toEqual({ ok: true, created: 80 });
  });
});
