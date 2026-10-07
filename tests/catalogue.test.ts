import { describe, expect, it } from "vitest";
import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { StaticCatalogueRepository } from "@/lib/repositories/static-catalogue";

const repo = new StaticCatalogueRepository();

describe("catalogue data integrity", () => {
  it("has exactly the categories the owner listed", () => {
    expect(categories.map((c) => c.name)).toEqual([
      "Pens",
      "Pencils",
      "Notebooks",
      "Registers",
      "Files",
      "Folders",
      "Calculators",
      "School Stationery",
      "Office Stationery",
      "Engineering Stationery",
      "Erasers",
      "Sharpeners",
      "Markers",
      "Highlighters",
      "Drawing Supplies",
      "Adhesive Tape",
      "Cello Tape",
      "Glue",
      "Glue Guns",
      "Glue Sticks",
      "Paper Products",
      "Writing Instruments",
      "Other Stationery",
    ]);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(categories.length);
  });

  it("lists only the five products the owner identified — no invented inventory", () => {
    expect(products.map((p) => p.name)).toEqual(["Glue Guns", "Glue Sticks & Glue Gun Sticks", "Cello Tape", "Adhesive Tape", "Calculators"]);
  });

  it("has unique slugs and every product points at a real category", () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const product of products) expect(categoryIds.has(product.categoryId)).toBe(true);
  });

  it("never carries prices, stock figures, SKUs or brand claims on the public product", () => {
    for (const product of products) {
      expect(Object.keys(product)).not.toEqual(expect.arrayContaining(["price"]));
      for (const forbidden of ["sku", "purchasePrice", "wholesalePrice", "retailPrice", "stockQuantity", "hsnCode", "gstRatePercent", "brandId"]) {
        expect(product, forbidden).not.toHaveProperty(forbidden);
      }
      expect(JSON.stringify(product)).not.toMatch(/₹|rs\.?\s?\d|in stock|\bmrp\b/i);
    }
  });
});

describe("brands", () => {
  const owner = [
    "DOMS", "Natraj", "Pidilite", "Linc", "Flair", "Cello", "Faber-Castell", "Luxor", "Kangaro", "STP", "Montex",
    "Artline", "Casio", "Shanti File", "Supra", "Goldex", "Reynolds", "Pierre Cardin", "Cello Tape", "Polo Tape", "Adhesive Tape", "Kores",
  ];

  it("keeps all 22 brands the owner listed, in their own list, separate from products", () => {
    expect(brands.map((b) => b.name)).toEqual(owner);
    expect(new Set(brands.map((b) => b.slug)).size).toBe(brands.length);
    for (const brand of brands) expect(Object.keys(brand).sort()).toEqual(["id", "listedPublicly", "name", "slug"]);
  });

  it("shows publicly every brand except the two that are really product types", async () => {
    const shown = (await repo.listBrands()).map((b) => b.name);
    expect(shown).toHaveLength(20);
    expect(shown).not.toContain("Cello Tape");
    expect(shown).not.toContain("Adhesive Tape");
    expect(shown).toContain("DOMS");
    expect(shown).toContain("Polo Tape");
  });
});

describe("StaticCatalogueRepository", () => {
  it("lists categories in sort order", async () => {
    const list = await repo.listCategories();
    expect(list.map((c) => c.sortOrder)).toEqual([...list.map((c) => c.sortOrder)].sort((a, b) => a - b));
  });

  it("searches by name, tag and category, case-insensitively", async () => {
    expect((await repo.searchProducts({ query: "GLUE GUN" })).items[0]?.slug).toBe("glue-guns");
    expect((await repo.searchProducts({ query: "sellotape" })).items.map((p) => p.slug)).toContain("cello-tape");
    const calculators = await repo.searchProducts({ query: "calculators" });
    // Non-empty FIRST: `[].every(...)` is true, so an empty result must never be able to pass this test.
    expect(calculators.total).toBe(products.filter((p) => p.categoryId === "calculators").length);
    expect(calculators.items.length).toBeGreaterThan(0);
    expect(calculators.items.every((p) => p.category.slug === "calculators")).toBe(true);
  });

  it("every category filters to exactly its own products (a broken filter must not pass quietly)", async () => {
    for (const category of categories) {
      const result = await repo.searchProducts({ categorySlug: category.slug, pageSize: 60 });
      const expected = products.filter((p) => p.categoryId === category.id).map((p) => p.slug).sort();
      expect(result.items.map((p) => p.slug).sort(), category.slug).toEqual(expected);
    }
    // ...and the filter is not vacuous: the categories that do have a product return it.
    const withProducts = categories.filter((c) => products.some((p) => p.categoryId === c.id));
    expect(withProducts.map((c) => c.slug)).toEqual(["calculators", "adhesive-tape", "cello-tape", "glue-guns", "glue-sticks"].sort((a, b) => categories.findIndex((c) => c.slug === a) - categories.findIndex((c) => c.slug === b)));
    for (const category of withProducts) expect((await repo.searchProducts({ categorySlug: category.slug })).total, category.slug).toBeGreaterThan(0);
  });

  it("requires every search word to match", async () => {
    expect((await repo.searchProducts({ query: "ball zzzzz" })).total).toBe(0);
  });

  it("filters by category and paginates", async () => {
    const glue = await repo.searchProducts({ categorySlug: "glue-guns" });
    expect(glue.total).toBe(products.filter((p) => p.categoryId === "glue-guns").length);
    expect(glue.items.length).toBeGreaterThan(0);
    expect(glue.items.every((p) => p.category.slug === "glue-guns")).toBe(true);

    const all = await repo.searchProducts({});
    expect(all.total).toBe(products.length);
    const page1 = await repo.searchProducts({ pageSize: 2, page: 1 });
    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(Math.ceil(all.total / 2));
    const last = await repo.searchProducts({ pageSize: 2, page: 999 });
    expect(last.page).toBe(last.totalPages);
  });

  it("looks up products by slug and tolerates a category with no related products", async () => {
    const product = await repo.getProductBySlug("calculators");
    expect(product?.category.slug).toBe("calculators");
    expect(await repo.getProductBySlug("does-not-exist")).toBeNull();
    expect(await repo.listRelatedProducts(product!)).toEqual([]); // the only product in its category
  });

  it("hides non-active products", async () => {
    const draft = { ...products[0]!, id: "draft", slug: "draft", status: "DRAFT" as const };
    const custom = new StaticCatalogueRepository(categories, [draft]);
    expect((await custom.searchProducts()).total).toBe(0);
  });
});
