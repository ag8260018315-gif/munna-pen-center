import { siteConfig } from "@/lib/config/site";

/**
 * Search-result copy for the static pages: the <title> and meta description.
 *
 * Rules (enforced by tests/seo-copy.test.ts so they cannot silently regress):
 *  - Title: at most 41 characters here, because the layout appends " | Munna Pen Center" (19) and
 *    search engines cut titles at about 60. Never repeat the brand name inside a title.
 *  - Description: at most 160 characters (longer ones are cut off in search results).
 *  - Plain, honest wording — no superlatives, prices or promises.
 *
 * The home page uses an absolute title (brand included) of at most 60 characters.
 */
export const TITLE_BASE_MAX = 41;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

export const pageSeo = {
  home: {
    title: "Wholesale Stationery Supplier in Dhanbad | Munna Pen Center",
    description:
      "Wholesale stationery and office supplies from Dhanbad, Jharkhand, for schools, offices, engineers and retailers across India. Request a bulk quote.",
  },
  products: {
    title: "Wholesale Stationery Catalogue",
    description:
      "Browse wholesale stationery and office supplies: pens, pencils, school, office and engineering supplies, calculators, files and paper. Request a quote.",
  },
  bulkOrders: {
    title: "Bulk Stationery Orders for India",
    description:
      "Need stationery in bulk? Schools, offices, businesses, engineers, institutions and retailers can send a requirement and get a wholesale quotation.",
  },
  requestQuote: {
    title: "Request a Wholesale Quote",
    description:
      "Request a wholesale quotation for stationery and office supplies from Dhanbad. Choose products, share approximate quantities and we will respond.",
  },
  about: {
    title: "About Us – Wholesale Stationery, Dhanbad",
    description:
      "Munna Pen Center is a wholesale stationery and office-supply supplier in Dhanbad, Jharkhand, serving customers and organisations across India.",
  },
  contact: {
    title: "Contact – Wholesale Stationery, Dhanbad",
    description: `Contact Munna Pen Center in Dhanbad for wholesale stationery and bulk orders. Call or WhatsApp ${siteConfig.contact.phoneDisplay}, or send a message.`,
  },
} as const;
