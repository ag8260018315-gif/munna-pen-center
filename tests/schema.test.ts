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
    // Evidence: deleting the person who decided or recorded something must not erase who it was.
    ["ApprovalRequest", "decidedBy"],
    ["Payment", "recordedBy"],
    // Deleting an enquiry must not detach the quotation that came from it.
    ["Quotation", "enquiry"],
    // A price the agent set must keep pointing at the approval that covers it.
    ["QuotationItem", "priceApproval"],
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

  it("record the financial year and sequence behind the number, so uniqueness per series and year is a constraint", () => {
    const invoice = model("Invoice");
    expect(invoice).toMatch(/\n\s*financialYear\s+String\?/);
    expect(invoice).toMatch(/\n\s*sequence\s+Int\?/);
    expect(invoice).toMatch(/@@unique\(\[financialYear, sequence\]\)/);
  });

  it("allocate numbers with an upsert, which also works on the first invoice of a new financial year", () => {
    expect(schema).toMatch(/INSERT INTO "NumberSequence"[\s\S]*ON CONFLICT[\s\S]*DO UPDATE/);
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

describe("AI work stays attributable", () => {
  it("every document the agent could draft or send records who created it", () => {
    for (const name of ["Quotation", "Order", "Invoice", "FollowUp"]) {
      expect(model(name), name).toMatch(/\n\s*createdBy\s+ActorType/);
    }
    expect(model("ApprovalRequest")).toMatch(/\n\s*requestedBy\s+ActorType/);
  });

  it("has no default actor: a code path that forgets to say who acted fails instead of being recorded as a human (or as the agent)", () => {
    for (const name of ["Quotation", "Order", "Invoice", "FollowUp"]) {
      expect(model(name), name).not.toMatch(/\n\s*createdBy\s+ActorType\s+@default/);
    }
    expect(model("ApprovalRequest")).not.toMatch(/\n\s*requestedBy\s+ActorType\s+@default/);
  });

  it("records who set each quotation price and, for an agent-set price, the approval that covers it", () => {
    const item = model("QuotationItem");
    expect(item).toMatch(/\n\s*priceSetBy\s+ActorType\?/);
    expect(item).toMatch(/\n\s*priceApprovalId\s+String\?/);
    expect(model("ApprovalRequest")).toMatch(/\n\s*pricedItems\s+QuotationItem\[\]/);
  });
});

describe("approvals keep their evidence", () => {
  it("the payload that will run is mandatory (a request with nothing to review cannot exist)", () => {
    expect(model("ApprovalRequest")).toMatch(/\n\s*payload\s+Json\s*(\n|\/\/)/);
    expect(model("ApprovalRequest")).not.toMatch(/\n\s*payload\s+Json\?/);
  });

  it("snapshots the approver's role at the moment of decision", () => {
    expect(model("ApprovalRequest")).toMatch(/\n\s*decidedByRole\s+AdminRole\?/);
  });

  it("documents, for the first migration, the rules Prisma cannot express", () => {
    const header = schema.slice(0, schema.indexOf("generator client"));
    for (const rule of [
      /status\s*<>\s*'APPROVED'[\s\S]*decidedById[\s\S]*decidedAt[\s\S]*decidedByRole\s*=\s*'OWNER'/, // approved => who, when, as OWNER
      /BEFORE UPDATE[\s\S]*(action|payloadHash)/i, // approved rows are frozen
      /BEFORE DELETE|REVOKE DELETE/i, // leaf evidence tables cannot be deleted
      /COALESCE\("quotationId"/, // the one-pending-per-target index must use COALESCE, because NULLs are distinct
      /status[^\n]*number IS NOT NULL|number IS NOT NULL/i, // issued invoice has a number
    ]) {
      expect(header, String(rule)).toMatch(rule);
    }
  });
});
