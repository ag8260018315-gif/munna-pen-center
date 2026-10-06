import { describe, expect, it } from "vitest";
import { bulkEnquirySchema, contactSchema, readItems, toFieldErrors } from "@/lib/validation/enquiry";

const valid = {
  kind: "bulk-order",
  name: "Asha Kumari",
  organization: "",
  phone: "98765 43210",
  email: "",
  city: "Ranchi",
  state: "Jharkhand",
  productsRequired: "Ball pens and registers",
  approximateQuantity: "",
  additionalRequirements: "",
  items: [],
};

describe("bulkEnquirySchema", () => {
  it("accepts a valid enquiry, normalising the phone and dropping empty optionals", () => {
    const result = bulkEnquirySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phone).toBe("+919876543210");
    expect(result.data.email).toBeUndefined();
    expect(result.data.organization).toBeUndefined();
  });

  it("requires name, phone, city and state", () => {
    const result = bulkEnquirySchema.safeParse({ ...valid, name: "", phone: "", city: "", state: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(toFieldErrors(result.error)).sort()).toEqual(["city", "name", "phone", "state"]);
  });

  it("rejects an invalid phone, email and state", () => {
    const result = bulkEnquirySchema.safeParse({ ...valid, phone: "12345", email: "nope", state: "Atlantis" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(errors.phone).toMatch(/10-digit/);
    expect(errors.email).toBeDefined();
    expect(errors.state).toMatch(/select/i);
  });

  it("needs products typed OR chosen from the enquiry list", () => {
    const none = bulkEnquirySchema.safeParse({ ...valid, productsRequired: "" });
    expect(none.success).toBe(false);

    const listed = bulkEnquirySchema.safeParse({ ...valid, productsRequired: "", items: [{ slug: "ball-pens", quantity: "10 boxes" }] });
    expect(listed.success).toBe(true);
  });

  it("caps field lengths", () => {
    const result = bulkEnquirySchema.safeParse({ ...valid, additionalRequirements: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts a name, phone and message", () => {
    const result = contactSchema.safeParse({ kind: "contact", name: "Ravi", phone: "9876543210", email: "", message: "Need a quote for registers" });
    expect(result.success).toBe(true);
  });

  it("requires a message", () => {
    expect(contactSchema.safeParse({ kind: "contact", name: "Ravi", phone: "9876543210", message: "" }).success).toBe(false);
  });
});

describe("readItems", () => {
  it("zips repeated itemSlug / itemQuantity fields", () => {
    const formData = new FormData();
    formData.append("itemSlug", "ball-pens");
    formData.append("itemQuantity", "10 boxes");
    formData.append("itemSlug", "gel-pens");
    formData.append("itemQuantity", "");
    expect(readItems(formData)).toEqual([
      { slug: "ball-pens", quantity: "10 boxes" },
      { slug: "gel-pens", quantity: "" },
    ]);
  });
});
