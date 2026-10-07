import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Guards on the design-only Prisma schema, from the PR #1 data-model review. The schema is not connected to a
 * database yet, so these tests are what stops a careless edit from re-opening the holes.
 */

let schema = "";
const model = (name: string) => new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? "";
const models = () => [...schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map((m) => ({ name: m[1]!, body: m[2]! }));

beforeAll(async () => {
  schema = await readFile("prisma/schema.prisma", "utf8");
});

describe("records the business must keep are not deletable by accident", () => {
  it("cascade-deletes only line items from their own parent document", () => {
    const withCascade = models().filter((m) => /onDelete: Cascade/.test(m.body)).map((m) => m.name).sort();
    // Deleting a Lead, Quotation, Order or Invoice must NOT silently take enquiries, approvals, GST lines or follow-ups with it.
    expect(withCascade).toEqual(["EnquiryItem", "OrderItem", "QuotationItem"]);
  });

  it.each([
    ["Enquiry", "lead"],
    ["InvoiceItem", "invoice"],
    ["Order", "quotation"],
    ["FollowUp", "lead"],
    ["FollowUp", "customer"],
    ["ApprovalRequest", "quotation"],
    ["ApprovalRequest", "order"],
    ["ApprovalRequest", "invoice"],
    ["ApprovalRequest", "lead"],
    ["ApprovalRequest", "customer"],
  ])("%s.%s is protected (onDelete: Restrict)", (modelName, field) => {
    const line = model(modelName).split("\n").find((l) => new RegExp(`^\\s*${field}\\s`).test(l)) ?? "";
    expect(line, `${modelName}.${field}`).toMatch(/onDelete: Restrict/);
  });
});

describe("a draft quotation can be genuinely unpriced", () => {
  it("quotation line prices, GST rate and totals are nullable until the owner has priced them", () => {
    const item = model("QuotationItem");
    for (const field of ["unitPrice", "gstRatePercent", "lineTotal"]) expect(item, field).toMatch(new RegExp(`\\n\\s*${field}\\s+Decimal\\?`));
    const quotation = model("Quotation");
    for (const field of ["subtotal", "taxTotal", "total"]) expect(quotation, field).toMatch(new RegExp(`\\n\\s*${field}\\s+Decimal\\?`));
  });

  it("order and invoice lines stay fully priced — those values are final", () => {
    for (const name of ["OrderItem", "InvoiceItem"]) {
      for (const field of ["unitPrice", "gstRatePercent", "lineTotal"]) {
        expect(model(name), `${name}.${field}`).toMatch(new RegExp(`\\n\\s*${field}\\s+Decimal\\s`));
      }
    }
  });
});

describe("GST invoices", () => {
  it("get a number only when issued, and numbers are unique", () => {
    expect(model("Invoice")).toMatch(/\n\s*number\s+String\?\s+@unique/);
  });

  it("snapshot buyer and supplier details at issue time", () => {
    const invoice = model("Invoice");
    for (const field of ["buyerName", "buyerAddress", "buyerGstin", "placeOfSupply", "supplierName", "supplierAddress", "supplierGstin"]) {
      expect(invoice, field).toMatch(new RegExp(`\\n\\s*${field}\\s+String\\?`));
    }
  });

  it("has a per-series, per-financial-year counter for gap-free serial numbers", () => {
    const sequence = model("NumberSequence");
    expect(sequence).toMatch(/\n\s*scope\s+String/);
    expect(sequence).toMatch(/\n\s*financialYear\s+String/);
    expect(sequence).toMatch(/\n\s*lastValue\s+Int/);
    expect(sequence).toMatch(/@@unique\(\[scope, financialYear\]\)/);
  });
});
