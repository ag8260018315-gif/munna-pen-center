import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { describeWebsiteStatus, WebsiteStatusBanner } from "@/components/admin/website-status";
import type { WebsiteStatus } from "@/lib/admin/catalogue-admin";
import { catalogueSourceFrom, similarSettingNames } from "@/lib/domain/website-source";
import { serverEnvSchema } from "@/lib/env";

const status = (extra: Partial<WebsiteStatus> = {}): WebsiteStatus => ({ source: "built-in", similarNames: [], visibleProducts: 0, hiddenByCategory: 0, draftProducts: 0, totalProducts: 0, ...extra });
const html = (s: WebsiteStatus, variant: "full" | "attention") => renderToStaticMarkup(createElement(WebsiteStatusBanner, { status: s, variant }));

describe("which catalogue the website reads", () => {
  it("reads the setting exactly as the site itself does (so the banner can never disagree with what visitors see)", () => {
    for (const value of [undefined, "", "  ", "database", " database ", '"database"', "'database'", "`database`", "static", "Database", "DATABASE", "databse", "db", "true", '"database', "database "]) {
      const parsed = serverEnvSchema.safeParse({ CATALOGUE_SOURCE: value });
      const expected = !parsed.success ? "invalid" : parsed.data.CATALOGUE_SOURCE === "database" ? "database" : "built-in";
      expect(catalogueSourceFrom(value), JSON.stringify(value)).toBe(expected);
    }
  });

  it("spots a mistyped setting NAME, and ignores the right one and unrelated names", () => {
    const names = ["DATABASE_URL", "CATALOGUE_SOURCE", "CATALOG_SOURCE", "catalogue_source", "CATALOGUE-SOURCE", "NEXT_PUBLIC_SITE_URL", "BUSINESS_GSTIN", "Catalog Source"];
    expect(similarSettingNames(names)).toEqual(["CATALOGUE-SOURCE", "CATALOG_SOURCE", "Catalog Source", "catalogue_source"]);
    expect(similarSettingNames(["CATALOGUE_SOURCE", "DATABASE_URL"])).toEqual([]);
  });
});

describe("the website status banner", () => {
  it("warns, with the fix, when products exist but the website still shows the built-in list", () => {
    const text = html(status({ visibleProducts: 36, totalProducts: 36 }), "full");
    expect(text).toContain("not showing these products yet");
    expect(text).toContain("36 Active products");
    expect(text).toContain("CATALOGUE_SOURCE");
    expect(text).toMatch(/Redeploy/);
    expect(html(status({ visibleProducts: 36 }), "attention")).toContain("not showing these products yet"); // also on the dashboard
  });

  it("names a wrongly spelled setting (names only) and says the right name", () => {
    const text = html(status({ similarNames: ["CATALOG_SOURCE"], visibleProducts: 1 }), "full");
    expect(text).toContain("CATALOG_SOURCE");
    expect(text).toContain("the name must be exactly");
    expect(text).toContain("1 Active product saved here cannot");
    // Even with no products yet, a misspelt setting is worth a warning.
    expect(html(status({ similarNames: ["CATALOG_SOURCE"] }), "attention")).toContain("CATALOG_SOURCE");
  });

  it("is quiet on the dashboard when nothing needs doing, and positive on the Products page", () => {
    expect(html(status(), "attention")).toBe(""); // built-in list, nothing to publish: nothing to say here
    expect(html(status({ source: "database", visibleProducts: 36 }), "attention")).toBe("");
    const ok = html(status({ source: "database", visibleProducts: 36 }), "full");
    expect(ok).toContain("showing the products saved here");
    expect(ok).toContain("36 products are visible");
    expect(html(status({ source: "database", visibleProducts: 1 }), "full")).toContain("1 product is visible");
  });

  it("warns when the website reads the database but visitors would see nothing, or some products are hidden", () => {
    expect(html(status({ source: "database", visibleProducts: 0, totalProducts: 5 }), "attention")).toContain("empty catalogue");
    const hidden = html(status({ source: "database", visibleProducts: 3, hiddenByCategory: 2 }), "attention");
    expect(hidden).toContain("2 Active products are hidden");
    expect(hidden).toContain("category is switched off");
    expect(hidden).not.toContain("showing the products saved here"); // the good news is only on the full view
  });

  it("flags a setting value it does not understand without printing the value", () => {
    const messages = describeWebsiteStatus(status({ source: "invalid" }));
    expect(messages).toHaveLength(1);
    expect(messages[0]!.tone).toBe("warning");
    expect(html(status({ source: "invalid" }), "full")).toContain("does not understand");
  });

  it("uses one heading per message, labelled sections, and decorative icons hidden from screen readers", () => {
    const text = html(status({ similarNames: ["CATALOG_SOURCE"], visibleProducts: 2, source: "built-in" }), "full");
    expect((text.match(/<h2/g) ?? []).length).toBe(1);
    expect(text).toMatch(/<section[^>]*aria-labelledby="site-status-0"/);
    expect(text).toContain('id="site-status-0"');
    expect(text).toContain('aria-hidden="true"');
  });
});
