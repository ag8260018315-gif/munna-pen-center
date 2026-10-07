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
  it("cascade-deletes only line items from their own parent document (and sign-in sessions with their user)", () => {
    const withCascade = models().filter((m) => /onDelete: Cascade/.test(m.body)).map((m) => m.name).sort();
    // Deleting a Lead, Quotation, Order or Invoice must NOT silently take enquiries, approvals, GST lines or follow-ups with it.
    expect(withCascade).toEqual(["AdminSession", "EnquiryItem", "OrderItem", "QuotationItem"]);
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
    // A brand or category with products cannot be deleted from under them.
    ["Product", "brand"],
    ["Product", "category"],
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

describe("catalogue: brands and the product fields the owner asked for", () => {
  it("brands live in their own table, separate from products", () => {
    const brand = model("Brand");
    expect(brand).toMatch(/\n\s*name\s+String\s+@unique/);
    expect(brand).toMatch(/\n\s*slug\s+String\s+@unique/);
    expect(brand).toMatch(/\n\s*isListedPublicly\s+Boolean\s+@default\(false\)/); // nothing is public until confirmed
    expect(model("Product")).toMatch(/\n\s*brandId\s+String\?/);
    expect(model("Product")).not.toMatch(/\n\s*brand\s+String/); // the old free-text column is gone
  });

  it("has every field the owner listed", () => {
    const product = model("Product");
    const wanted: Record<string, RegExp> = {
      name: /\n\s*name\s+String\s/,
      brand: /\n\s*brandId\s+String\?/,
      category: /\n\s*categoryId\s+String\s/,
      sku: /\n\s*sku\s+String\?\s+@unique/,
      description: /\n\s*description\s+String\?/,
      unit: /\n\s*unit\s+String\?/,
      packSize: /\n\s*packSize\s+String\?/,
      purchasePrice: /\n\s*purchasePrice\s+Decimal\?\s+@db\.Decimal\(12, 2\)/,
      wholesalePrice: /\n\s*wholesalePrice\s+Decimal\?\s+@db\.Decimal\(12, 2\)/,
      retailPrice: /\n\s*retailPrice\s+Decimal\?\s+@db\.Decimal\(12, 2\)/,
      gstRatePercent: /\n\s*gstRatePercent\s+Decimal\?\s+@db\.Decimal\(5, 2\)/,
      hsnCode: /\n\s*hsnCode\s+String\?/,
      stockQuantity: /\n\s*stockQuantity\s+Int\?/,
      minOrderQuantity: /\n\s*minOrderQuantity\s+Int\?/,
      image: /\n\s*imageUrl\s+String\?/,
      status: /\n\s*status\s+ProductStatus\s+@default\(DRAFT\)/,
    };
    for (const [field, pattern] of Object.entries(wanted)) expect(product, field).toMatch(pattern);
  });

  it("never invents values: no business field has a default (a new product is a DRAFT with everything else empty)", () => {
    const product = model("Product");
    for (const field of ["sku", "unit", "packSize", "purchasePrice", "wholesalePrice", "retailPrice", "hsnCode", "gstRatePercent", "stockQuantity", "minOrderQuantity"]) {
      const line = product.split("\n").find((l) => new RegExp(`^\\s*${field}\\s`).test(l)) ?? "";
      expect(line, field).toMatch(/\?/); // nullable
      expect(line, field).not.toMatch(/@default/);
    }
  });

  it("product status can deactivate without deleting", () => {
    const block = /enum ProductStatus \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    expect(block.split("\n").map((l) => l.trim()).filter(Boolean)).toEqual(["DRAFT", "ACTIVE", "INACTIVE"]);
  });

  it("the public Product type carries none of the internal fields", async () => {
    const types = await readFile("lib/domain/types.ts", "utf8");
    const publicProduct = /export interface Product \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
    expect(publicProduct.length).toBeGreaterThan(50);
    for (const field of ["purchasePrice", "wholesalePrice", "retailPrice", "price", "sku", "stockQuantity", "minOrderQuantity", "hsnCode", "gstRatePercent"]) {
      expect(publicProduct, field).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });
});

describe("every relation states what happens on delete", () => {
  it("no @relation(fields: …) relies on Prisma's default", () => {
    const relations = [...schema.matchAll(/^\s*(\w+)\s+\w+\??\s+@relation\(([^)]*fields:[^)]*)\)/gm)];
    expect(relations.length).toBeGreaterThan(30); // the pattern really finds them
    expect(relations.filter((m) => !/onDelete:/.test(m[2]!)).map((m) => m[1])).toEqual([]);
  });

  it("every table is listed for row-level security in the migration notes", () => {
    const header = schema.slice(0, schema.indexOf("generator client"));
    expect(header).toMatch(/ENABLE ROW LEVEL SECURITY/);
  });
});

describe("admin sign-in data", () => {
  it("stores only a hash of the session token, never the token", () => {
    const session = model("AdminSession");
    expect(session).toMatch(/\n\s*tokenHash\s+String\s+@unique/);
    expect(session).not.toMatch(/\n\s*token\s+String/);
    expect(session).toMatch(/\n\s*expiresAt\s+DateTime\s/);
  });

  it("locks out repeated failed sign-ins", () => {
    const user = model("AdminUser");
    expect(user).toMatch(/\n\s*failedLoginCount\s+Int\s+@default\(0\)/);
    expect(user).toMatch(/\n\s*lockedUntil\s+DateTime\?/);
  });
});
