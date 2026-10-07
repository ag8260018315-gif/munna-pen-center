import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/config/site";
import { formatIndianPhone, normaliseIndianMobile, toWhatsAppNumber } from "@/lib/phone";
import { buildEnquiryWhatsAppMessage, buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

describe("normaliseIndianMobile", () => {
  it.each([
    ["7979025166", "+917979025166"],
    ["+91 79790 25166", "+917979025166"],
    ["91-7979025166", "+917979025166"],
    ["07979025166", "+917979025166"],
    [" (+91) 79790-25166 ", "+917979025166"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseIndianMobile(input)).toBe(expected);
  });

  it.each(["", "12345", "5979025166", "79790251667", "+1 202 555 0143", "abcdefghij"])("rejects %s", (input) => {
    expect(normaliseIndianMobile(input)).toBeNull();
  });
});

describe("phone formatting", () => {
  it("formats for display and WhatsApp", () => {
    expect(formatIndianPhone("+917979025166")).toBe("+91 79790 25166");
    expect(toWhatsAppNumber("+917979025166")).toBe("917979025166");
  });
});

describe("WhatsApp links", () => {
  it("uses the business number in international format with no + or spaces", () => {
    expect(siteConfig.contact.phoneE164).toBe("+917979025166");
    expect(buildWhatsAppUrl()).toBe("https://wa.me/917979025166");
  });

  it("pre-fills the required messages, URL-encoded", () => {
    const general = new URL(buildWhatsAppUrl(whatsAppMessages.general));
    expect(general.origin + general.pathname).toBe("https://wa.me/917979025166");
    expect(general.searchParams.get("text")).toBe("Hello Munna Pen Center, I am interested in wholesale stationery products.");

    const bulk = new URL(buildWhatsAppUrl(whatsAppMessages.bulkOrder));
    expect(bulk.searchParams.get("text")).toBe("Hello Munna Pen Center, I want to enquire about a bulk stationery order.");
  });

  it("builds an enquiry message with only the fields that were provided", () => {
    const message = buildEnquiryWhatsAppMessage({
      name: "Asha",
      phone: "+919876543210",
      city: "Ranchi",
      state: "Jharkhand",
      productsRequired: "Ball Pens (10 boxes)",
      reference: "ENQ-20261006-ABCD",
    });
    expect(message).toContain("Name: Asha");
    expect(message).toContain("City: Ranchi, Jharkhand");
    expect(message).toContain("Reference: ENQ-20261006-ABCD");
    expect(message).not.toContain("Organization");
    expect(message).not.toContain("Notes");
  });

  it("truncates very long fields so the link stays usable", () => {
    const message = buildEnquiryWhatsAppMessage({ name: "A", phone: "+919876543210", productsRequired: "x".repeat(5000) });
    expect(message.length).toBeLessThan(800);
  });
});
