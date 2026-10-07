import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/config/site";
import { absoluteUrl, breadcrumbJsonLd, defaultOgImage, organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";

describe("pageMetadata", () => {
  const meta = pageMetadata({ title: "Bulk Orders", description: "Order stationery in bulk.", path: "/bulk-orders" });

  it("sets a canonical path, Open Graph and Twitter tags — including the share image", () => {
    expect(meta.alternates?.canonical).toBe("/bulk-orders");
    expect(meta.openGraph).toMatchObject({ type: "website", locale: "en_IN", siteName: siteConfig.name, url: "/bulk-orders" });
    // A page-level openGraph replaces the root one, so the image must be set here (regression: og:image was missing).
    expect(meta.openGraph?.images).toEqual([defaultOgImage]);
    expect(meta.twitter?.images).toEqual([defaultOgImage.url]);
  });

  it("appends the site name via the layout template, or uses an absolute title when asked", () => {
    expect(meta.title).toBe("Bulk Orders");
    const home = pageMetadata({ title: "Home title", description: "d", path: "/", absoluteTitle: true });
    expect(home.title).toEqual({ absolute: "Home title" });
  });

  it("can keep a page out of search results", () => {
    expect(pageMetadata({ title: "t", description: "d", path: "/x", noIndex: true }).robots).toEqual({ index: false, follow: true });
    expect(meta.robots).toBeUndefined();
  });
});

describe("structured data", () => {
  it("builds absolute URLs", () => {
    expect(absoluteUrl("/products")).toBe(`${siteConfig.url}/products`);
    expect(absoluteUrl("products")).toBe(`${siteConfig.url}/products`);
  });

  it("describes the organisation using only facts the owner supplied", () => {
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org.name).toBe("Munna Pen Center");
    expect(org.telephone).toBe("+917979025166");
    // Both numbers are published as contact points.
    expect((org.contactPoint as { telephone: string }[]).map((point) => point.telephone)).toEqual(["+917979025166", "+918051388653"]);
    // The owner supplied the street address and email; the PIN code is still unknown and must not appear.
    expect(org.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Dhanbad",
      addressRegion: "Jharkhand",
      addressCountry: "IN",
      streetAddress: "Railway Cinema Road, Purana Bazar",
    });
    expect(org.email).toBe("munnapen123@gmail.com");
    // Nothing invented: no postcode, GSTIN, ratings, reviews or founding date until provided.
    for (const key of ["taxID", "vatID", "aggregateRating", "review", "foundingDate", "numberOfEmployees", "award"]) expect(org).not.toHaveProperty(key);
    expect(JSON.stringify(org)).not.toMatch(/postalCode/);
  });

  it("describes the website with a product-search action", () => {
    const site = websiteJsonLd() as { potentialAction: { target: { urlTemplate: string } } };
    expect(site.potentialAction.target.urlTemplate).toContain("/products?q={search_term_string}");
  });

  it("numbers breadcrumb items from 1", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(crumbs.itemListElement.map((c) => c.position)).toEqual([1, 2]);
    expect(crumbs.itemListElement[1]?.item).toBe(absoluteUrl("/products"));
  });
});
