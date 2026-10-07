import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, TITLE_BASE_MAX, TITLE_MAX, pageSeo } from "@/content/seo";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { productSeoDescription, productSeoTitle } from "@/lib/catalogue-seo";
import { siteConfig } from "@/lib/config/site";

const SUFFIX = ` | ${siteConfig.name}`; // appended by the layout's title template
const BRAND = /munna pen center/i;

describe("search-result copy stays within what search engines show", () => {
  it("home: absolute title within 60 characters", () => {
    expect(pageSeo.home.title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(Object.entries(pageSeo).filter(([key]) => key !== "home"))("%s: title + site suffix fits, brand not repeated", (_key, seo) => {
    expect(seo.title.length).toBeLessThanOrEqual(TITLE_BASE_MAX);
    expect(seo.title + SUFFIX).not.toMatch(new RegExp(`${BRAND.source}[\\s\\S]*${BRAND.source}`, "i"));
    expect((seo.title + SUFFIX).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(Object.entries(pageSeo))("%s: description is 70-160 characters", (_key, seo) => {
    expect(seo.description.length).toBeGreaterThanOrEqual(70);
    expect(seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("every category page", () => {
    for (const category of categories) {
      expect((category.seoTitle + SUFFIX).length, category.slug).toBeLessThanOrEqual(TITLE_MAX);
      expect(category.seoTitle, category.slug).not.toMatch(BRAND);
      expect(category.seoTitle, `${category.slug} has a stray separator`).not.toMatch(/\|/);
      expect(category.seoDescription.length, category.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(category.seoDescription.length, category.slug).toBeGreaterThanOrEqual(70);
    }
  });

  it("every product page", () => {
    for (const product of products) {
      expect((productSeoTitle(product) + SUFFIX).length, product.slug).toBeLessThanOrEqual(TITLE_MAX);
      const description = productSeoDescription(product);
      expect(description.length, product.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(description.startsWith(product.shortDescription), product.slug).toBe(true);
    }
  });

  it("titles and descriptions are unique, so pages are not competing with each other", () => {
    const titles = [...categories.map((c) => c.seoTitle), ...products.map((p) => productSeoTitle(p)), ...Object.values(pageSeo).map((s) => s.title)];
    const descriptions = [...categories.map((c) => c.seoDescription), ...products.map((p) => productSeoDescription(p)), ...Object.values(pageSeo).map((s) => s.description)];
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe("product description shortening", () => {
  const withBase = (length: number) => ({ shortDescription: "x".repeat(length) });
  const WITH_BRAND = " Wholesale supply from Munna Pen Center, Dhanbad, across India. Request a quote.";
  const SHORT_CTA = " Request a wholesale quote.";

  it("uses the fullest wording that fits", () => {
    const base = "x".repeat(40);
    expect(productSeoDescription({ shortDescription: base })).toBe(`${base}${WITH_BRAND}`);
  });

  it("falls back to shorter wording as the product's own sentence grows", () => {
    const medium = productSeoDescription(withBase(120));
    expect(medium.endsWith(SHORT_CTA.trim())).toBe(true);
    expect(medium.length).toBeLessThanOrEqual(DESCRIPTION_MAX);

    const long = productSeoDescription(withBase(150));
    expect(long).toBe("x".repeat(150));
  });

  it("never exceeds the limit, even when the product's own sentence is too long", () => {
    const out = productSeoDescription(withBase(400));
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith("…")).toBe(true);
  });
});
