import { formatIndianPhone, normaliseIndianMobile } from "@/lib/phone";
import { normaliseSiteUrl } from "@/lib/site-url-check";

/**
 * Single source of truth for business details.
 *
 * Only facts supplied by the business owner are filled in. Everything else is
 * `null` and the UI simply omits it until a real value is provided — nothing on
 * the site is invented. See docs/CONTENT_CHECKLIST.md for what to add before launch.
 */

const phoneE164 = normaliseIndianMobile("7979025166");
if (!phoneE164) throw new Error("siteConfig: business phone number is not a valid Indian mobile number");

// A second number to CALL. Only the main number above is used for WhatsApp links, because the owner has not said the
// second one is on WhatsApp.
const secondPhoneE164 = normaliseIndianMobile("8051388653");
if (!secondPhoneE164) throw new Error("siteConfig: second business phone number is not a valid Indian mobile number");

export const siteConfig = {
  name: "Munna Pen Center",
  tagline: "Wholesale Stationery & Office Supplies",
  description:
    "Munna Pen Center is a wholesale stationery and office supplies supplier in Dhanbad, Jharkhand, serving schools, offices, engineers, businesses, institutions and retailers across India.",

  /**
   * Canonical origin, used for sitemap, canonical URLs and Open Graph.
   * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://www.yourdomain.in).
   */
  // normaliseSiteUrl: a blank or malformed value (e.g. "yourdomain.in") must not reach `new URL()` in the layout.
  url: normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
  locale: "en_IN",

  location: {
    locality: "Dhanbad",
    region: "Jharkhand",
    country: "India",
    countryCode: "IN",
    /** Supplied by the owner. The PIN code has not been provided yet — it is simply not shown. */
    streetAddress: "Railway Cinema Road, Purana Bazar" as string | null,
    postalCode: null as string | null,
  },

  contact: {
    /** Main number: phone AND WhatsApp. Every WhatsApp link on the site uses this one. */
    phoneE164,
    phoneDisplay: formatIndianPhone(phoneE164),
    /** Further numbers, shown for calling only (never used for WhatsApp links). */
    additionalPhones: [{ e164: secondPhoneE164, display: formatIndianPhone(secondPhoneE164) }],
    email: "munnapen123@gmail.com" as string | null,
    /** Not provided yet. */
    businessHours: null as string | null,
  },

  /**
   * The business is GST registered, and the public site says only that — it never prints the GSTIN number. The GSTIN
   * is deliberately NOT in source code either: it is the server-only BUSINESS_GSTIN environment variable, read by
   * `getBusinessGstin()` (lib/business.ts) for invoices and the admin later.
   */
  gst: {
    registered: true,
  },

  /** Social profiles — none provided yet. */
  social: {
    facebook: null as string | null,
    instagram: null as string | null,
    youtube: null as string | null,
  },
} as const;

export type SiteConfig = typeof siteConfig;
