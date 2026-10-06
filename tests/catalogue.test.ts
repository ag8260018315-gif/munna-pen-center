import { describe, expect, it } from "vitest";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { StaticCatalogueRepository } from "@/lib/repositories/static-catalogue";

const repo = new StaticCatalogueRepository();

describe("catalogue data integrity", () => {
  it("has the ten required categories", () => {
    expect(categories.map((c) => c.name)).toEqual([
      "Pens",
      "Pencils",
      "School Supplies",
      "Office Supplies",
      "Engineering Supplies",
      "Calculators",
      "Writing & Drawing Supplies",
      "Files & Folders",
      "Paper & Registers",
      "Other Stationery",
    ]);
  });

  it("has unique slugs and every product points at a real category", () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const product of products) expect(categoryIds.has(product.categoryId)).toBe(true);
  });

  it("every category has at least one product", () => {
    for (const category of categories) {
      expect(products.some((p) => p.categoryId === category.id)).toBe(true);
    }
  });

  it("never carries prices, stock figures or brand claims", () => {
    for (const product of products) {
      expect(Object.keys(product)).not.toEqual(expect.arrayContaining(["price"]));
      expect(JSON.stringify(product)).not.toMatch(/₹|rs\.?\s?\d|in stock|\bmrp\b/i);
    }
  });

  it("keeps SEO titles and descriptions within sensible lengths", () => {
    for (const category of categories) {
      expect(category.seoTitle.length).toBeLessThanOrEqual(70);
      expect(category.seoDescription.length).toBeLessThanOrEqual(175);
    }
  });
});

describe("StaticCatalogueRepository", () => {
  it("lists categories in sort order", async () => {
    const list = await repo.listCategories();
    expect(list.map((c) => c.sortOrder)).toEqual([...list.map((c) => c.sortOrder)].sort((a, b) => a - b));
  });

  it("searches by name, tag and category, case-insensitively", async () => {
    expect((await repo.searchProducts({ query: "BALL PEN" })).items[0]?.slug).toBe("ball-pens");
    expect((await repo.searchProducts({ query: "xerox" })).items.map((p) => p.slug)).toContain("copier-paper");
    expect((await repo.searchProducts({ query: "calculators" })).items.every((p) => p.category.slug === "calculators")).toBe(true);
  });

  it("requires every search word to match", async () => {
    expect((await repo.searchProducts({ query: "ball zzzzz" })).total).toBe(0);
  });

  it("filters by category and paginates", async () => {
    const pens = await repo.searchProducts({ categorySlug: "pens" });
    expect(pens.items.every((p) => p.category.slug === "pens")).toBe(true);

    const all = await repo.searchProducts({});
    const page1 = await repo.searchProducts({ pageSize: 10, page: 1 });
    expect(page1.items).toHaveLength(10);
    expect(page1.totalPages).toBe(Math.ceil(all.total / 10));
    const last = await repo.searchProducts({ pageSize: 10, page: 999 });
    expect(last.page).toBe(last.totalPages);
  });

  it("looks up products and related products by slug", async () => {
    const product = await repo.getProductBySlug("gel-pens");
    expect(product?.category.slug).toBe("pens");
    expect(await repo.getProductBySlug("does-not-exist")).toBeNull();
    const related = await repo.listRelatedProducts(product!);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((p) => p.category.id === product!.category.id && p.id !== product!.id)).toBe(true);
  });

  it("hides non-active products", async () => {
    const draft = { ...products[0]!, id: "draft", slug: "draft", status: "DRAFT" as const };
    const custom = new StaticCatalogueRepository(categories, [draft]);
    expect((await custom.searchProducts()).total).toBe(0);
  });
});
