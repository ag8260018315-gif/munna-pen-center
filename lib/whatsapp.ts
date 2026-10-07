import { siteConfig } from "@/lib/config/site";
import { toWhatsAppNumber } from "@/lib/phone";
import { truncate, wellFormed } from "@/lib/text";

/**
 * Click-to-chat links (`https://wa.me/<number>?text=<message>`).
 *
 * This is the public, credential-free way to open WhatsApp from the website.
 * The WhatsApp Business *API* (for automated sales conversations) is a separate,
 * server-side integration — see docs/AI_SALES_AGENT.md. Its credentials live in
 * environment variables and are never shipped to the browser.
 */
export function buildWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${toWhatsAppNumber(siteConfig.contact.phoneE164)}`;
  // wellFormed(): encodeURIComponent THROWS on a lone surrogate, and a link builder must never fail.
  return message ? `${base}?text=${encodeURIComponent(wellFormed(message))}` : base;
}

/** Ready-made messages used across the site. Edit the wording in one place. */
export const whatsAppMessages = {
  general: "Hello Munna Pen Center, I am interested in wholesale stationery products.",
  bulkOrder: "Hello Munna Pen Center, I want to enquire about a bulk stationery order.",
  product: (productName: string) =>
    `Hello Munna Pen Center, I am interested in wholesale pricing for: ${productName}.`,
} as const;

const clip = (text: string, max = 300) => truncate(text, max);

interface EnquiryMessageFields {
  name: string;
  organization?: string;
  phone: string;
  city?: string;
  state?: string;
  productsRequired: string;
  approximateQuantity?: string;
  additionalRequirements?: string;
  reference?: string;
}

/**
 * Turns a validated enquiry into a pre-filled WhatsApp message. Used for the
 * "send this on WhatsApp" button after submission, and as the fallback when the
 * enquiry could not be saved — the customer's requirement is never lost.
 */
export function buildEnquiryWhatsAppMessage(fields: EnquiryMessageFields, intro: string = whatsAppMessages.bulkOrder): string {
  const lines = [intro, ""];
  const add = (label: string, value?: string) => {
    if (value) lines.push(`${label}: ${clip(value)}`);
  };
  add("Name", fields.name);
  add("Organization", fields.organization);
  add("Phone", fields.phone);
  add("City", [fields.city, fields.state].filter(Boolean).join(", "));
  add("Products", fields.productsRequired);
  add("Approx. quantity", fields.approximateQuantity);
  add("Notes", fields.additionalRequirements);
  add("Reference", fields.reference);
  return lines.join("\n");
}
