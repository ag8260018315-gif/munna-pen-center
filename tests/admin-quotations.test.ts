import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("quotations on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let q: typeof import("@/lib/admin/quotation-admin");
  let customers: typeof import("@/lib/admin/customer-admin");
  let role: "OWNER" | "STAFF" = "OWNER";
  let signedIn = true;
  let customerId = "";
  let productId = "";
  const P = "qtest-";

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    const session = () => ({ userId: "u", email: "t@example.test", name: "T", role, isPreview: false });
    vi.doMock("@/lib/auth/guard", () => ({
      requireAdmin: async () => {
        if (!signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
        return session();
      },
      requireOwner: async () => {
        if (!signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
        if (role !== "OWNER") throw new Error("NEXT_NOT_FOUND");
        return session();
      },
    }));
    db = (await import("@/lib/db/client")).getDb();
    q = await import("@/lib/admin/quotation-admin");
    customers = await import("@/lib/admin/customer-admin");
    await cleanup();
    await db.category.create({ data: { id: `${P}cat`, slug: `${P}cat`, name: "QTest Cat" } });
    productId = (await db.product.create({ data: { id: `${P}prod`, slug: `${P}prod`, name: "QTest Pen", categoryId: `${P}cat`, unit: "box", wholesalePrice: "50.00", gstRatePercent: "12", hsnCode: "9608" } })).id;
  });
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });
  async function cleanup() {
    // Quotations can not be deleted by design (trigger), so tests use a dedicated customer whose rows we leave tagged.
    // They are removed by truncating inside a replica-role session, which is only possible on a throwaway database.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      await tx.$executeRawUnsafe(`DELETE FROM "QuotationItem" WHERE "quotationId" IN (SELECT q."id" FROM "Quotation" q JOIN "Customer" c ON c."id" = q."customerId" WHERE c."organizationName" LIKE 'QTest %')`);
      await tx.$executeRawUnsafe(`DELETE FROM "Quotation" WHERE "customerId" IN (SELECT "id" FROM "Customer" WHERE "organizationName" LIKE 'QTest %')`);
      await tx.$executeRawUnsafe(`DELETE FROM "Enquiry" WHERE "leadId" IN (SELECT "id" FROM "Lead" WHERE "phone" LIKE '+9100000099%')`);
      await tx.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "phone" LIKE '+9100000099%'`);
      await tx.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "organizationName" LIKE 'QTest %'`);
      await tx.$executeRawUnsafe(`DELETE FROM "Product" WHERE "id" LIKE '${P}%'`);
      await tx.$executeRawUnsafe(`DELETE FROM "Category" WHERE "id" LIKE '${P}%'`);
    });
  }
  beforeEach(async () => {
    role = "OWNER";
    signedIn = true;
    customerId = (await db.customer.create({ data: { organizationName: `QTest School ${Math.random().toString(36).slice(2, 8)}`, contactName: "Asha", phone: "+917979000001" } })).id;
  });

  const line = (extra: Record<string, string> = {}) => ({ description: "Blue pen", quantity: "10", unit: "box", ...extra });
  const newQuote = async () => {
    const r = await q.createQuotationForCustomer(customerId);
    if (!r.ok) throw new Error("setup");
    return r.id;
  };

  it("refuses everyone who is not signed in", async () => {
    signedIn = false;
    await expect(q.createQuotationForCustomer(customerId)).rejects.toThrow("NEXT_REDIRECT");
    await expect(q.listQuotations({})).rejects.toThrow("NEXT_REDIRECT");
    await expect(q.setQuotationStatus("x", "SENT")).rejects.toThrow("NEXT_REDIRECT");
    await expect(customers.listCustomers({})).rejects.toThrow("NEXT_REDIRECT");
  });

  it("numbers quotations without gaps or repeats, even when created at the same moment", async () => {
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => q.createQuotationForCustomer(customerId)));
    expect(ids.every((r) => r.ok)).toBe(true);
    const rows = await db.quotation.findMany({ where: { customerId }, select: { number: true } });
    const numbers = rows.map((r) => Number(r.number.split("-").pop())).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(5);
    expect(numbers[4]! - numbers[0]!).toBe(4);
    expect(rows[0]!.number).toMatch(/^QT-\d{4}-\d{2}-\d{4,}$/);
  });

  it("starts as a DRAFT with NULL totals and nothing invented", async () => {
    const id = await newQuote();
    expect(await db.quotation.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "DRAFT", createdBy: "ADMIN", subtotal: null, taxTotal: null, total: null, validUntil: null, terms: null, notes: null, sentAt: null });
  });

  it("computes line totals and exact quotation totals as lines change", async () => {
    const id = await newQuote();
    expect(await q.addQuotationLine(id, line({ unitPrice: "33.33", quantity: "3", gstRatePercent: "18" }))).toMatchObject({ ok: true });
    expect(await q.addQuotationLine(id, line({ description: "Pencil", quantity: "1", unitPrice: "0.05", gstRatePercent: "12" }))).toMatchObject({ ok: true });
    let quote = await db.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });
    expect(quote.subtotal?.toString()).toBe("100.04");
    expect(quote.taxTotal?.toString()).toBe("18.01");
    expect(quote.total?.toString()).toBe("118.05");
    expect(quote.items.every((i) => i.priceSetBy === "ADMIN")).toBe(true);
    // an unpriced line makes the totals NULL again — never a partial number
    await q.addQuotationLine(id, line({ description: "Unpriced" }));
    quote = await db.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });
    expect(quote.total).toBeNull();
    const unpriced = quote.items.find((i) => i.description === "Unpriced")!;
    expect(unpriced).toMatchObject({ unitPrice: null, priceSetBy: null, lineTotal: null });
    await q.removeQuotationLine(unpriced.id);
    expect((await db.quotation.findUniqueOrThrow({ where: { id } })).total?.toString()).toBe("118.05");
  });

  it("choosing a product fills blank fields from it — price only for the owner", async () => {
    const id = await newQuote();
    await q.addQuotationLine(id, { productId, quantity: "2", unit: "box" });
    role = "STAFF";
    await q.addQuotationLine(id, { productId, quantity: "2", unit: "box" });
    const items = await db.quotationItem.findMany({ where: { quotationId: id }, orderBy: { id: "asc" } });
    expect(items[0]).toMatchObject({ description: "QTest Pen", productId, hsnCode: "9608" });
    expect(items[0]!.unitPrice?.toString()).toBe("50");
    expect(items[0]!.gstRatePercent?.toString()).toBe("12");
    expect(items[1]).toMatchObject({ description: "QTest Pen", unitPrice: null, gstRatePercent: null, hsnCode: null, priceSetBy: null });
  });

  it("staff can not enter prices, GST or HSN, nor change them, but can change quantity and wording", async () => {
    const id = await newQuote();
    await q.addQuotationLine(id, line({ unitPrice: "10", gstRatePercent: "18", hsnCode: "9608" }));
    const stored = (await db.quotationItem.findFirstOrThrow({ where: { quotationId: id } })).id;
    role = "STAFF";
    expect(await q.addQuotationLine(id, line({ unitPrice: "1" }))).toMatchObject({ ok: false });
    expect(await q.updateQuotationLine(stored, line({ unitPrice: "9", gstRatePercent: "18", hsnCode: "9608" }))).toMatchObject({ ok: false });
    // a staff form does not send the disabled price boxes: edits go through and the stored prices stay
    expect(await q.updateQuotationLine(stored, line({ description: "Blue pen, 0.5 mm", quantity: "20" }))).toMatchObject({ ok: true });
    const after = await db.quotationItem.findUniqueOrThrow({ where: { id: stored } });
    expect(after).toMatchObject({ description: "Blue pen, 0.5 mm", quantity: 20, hsnCode: "9608" });
    expect(after.unitPrice?.toString()).toBe("10");
    expect(after.lineTotal?.toString()).toBe("200");
  });

  it("only the owner can change a quotation's status", async () => {
    const id = await newQuote();
    role = "STAFF";
    await expect(q.setQuotationStatus(id, "SENT")).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await db.quotation.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });

  it("will not mark a quotation sent until every line has a price and a GST rate", async () => {
    const id = await newQuote();
    expect(await q.setQuotationStatus(id, "SENT")).toMatchObject({ ok: false }); // no lines
    await q.addQuotationLine(id, line({ unitPrice: "10" })); // no GST
    expect(await q.setQuotationStatus(id, "SENT")).toMatchObject({ ok: false, message: expect.stringContaining("GST") });
    const lineId = (await db.quotationItem.findFirstOrThrow({ where: { quotationId: id } })).id;
    await q.updateQuotationLine(lineId, line({ unitPrice: "10", gstRatePercent: "18" }));
    expect(await q.setQuotationStatus(id, "SENT")).toMatchObject({ ok: true });
    expect(await db.quotation.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "SENT" });
    expect((await db.quotation.findUniqueOrThrow({ where: { id } })).sentAt).toBeInstanceOf(Date);
  });

  it("freezes a sent quotation: no line edits, header edits or re-sending; only the allowed next steps", async () => {
    const id = await newQuote();
    await q.addQuotationLine(id, line({ unitPrice: "10", gstRatePercent: "18" }));
    await q.setQuotationStatus(id, "SENT");
    const lineId = (await db.quotationItem.findFirstOrThrow({ where: { quotationId: id } })).id;
    expect(await q.addQuotationLine(id, line({ unitPrice: "1", gstRatePercent: "5" }))).toMatchObject({ ok: false });
    expect(await q.updateQuotationLine(lineId, line({ unitPrice: "1", gstRatePercent: "5" }))).toMatchObject({ ok: false });
    expect(await q.removeQuotationLine(lineId)).toMatchObject({ ok: false });
    expect(await q.updateQuotationHeader(id, { notes: "x" })).toMatchObject({ ok: false });
    expect(await q.setQuotationStatus(id, "SENT")).toMatchObject({ ok: false });
    expect(await q.setQuotationStatus(id, "ACCEPTED")).toMatchObject({ ok: true });
    expect(await q.setQuotationStatus(id, "CANCELLED")).toMatchObject({ ok: false }); // accepted is final here
    expect(await q.setQuotationStatus(id, "BOGUS")).toMatchObject({ ok: false });
    // even a direct database write can not change the lines of an accepted quotation
    await expect(db.quotationItem.update({ where: { id: lineId }, data: { quantity: 99 } })).rejects.toThrow();
  });

  it("saves the header: validity runs to the end of the day in India; terms and notes are optional", async () => {
    const id = await newQuote();
    expect(await q.updateQuotationHeader(id, { validUntil: "2030-01-31", terms: "Payment as agreed", notes: "" })).toMatchObject({ ok: true });
    const row = await db.quotation.findUniqueOrThrow({ where: { id } });
    expect(row.validUntil?.toISOString()).toBe("2030-01-31T18:29:59.000Z");
    expect(row).toMatchObject({ terms: "Payment as agreed", notes: null });
    expect(await q.updateQuotationHeader(id, { validUntil: "31/01/2030" })).toMatchObject({ ok: false, fieldErrors: { validUntil: expect.any(String) } });
  });

  it("rejects bad lines without writing", async () => {
    const id = await newQuote();
    for (const bad of [line({ quantity: "0" }), line({ quantity: "1.5" }), line({ unit: "" }), line({ unitPrice: "-1" }), line({ gstRatePercent: "101" }), line({ productId: "nope" }), { quantity: "1", unit: "pcs" }]) {
      expect(await q.addQuotationLine(id, bad), JSON.stringify(bad)).toMatchObject({ ok: false });
    }
    expect(await db.quotationItem.count({ where: { quotationId: id } })).toBe(0);
  });

  it("turns an enquiry into a draft: creates the customer, lines from the enquiry, and is safe to click twice", async () => {
    const lead = await db.lead.create({ data: { name: "QTest Buyer", organizationName: "QTest Sunrise School", phone: "+9100000099001", email: null, city: "Ranchi", state: "Jharkhand" } });
    const enquiry = await db.enquiry.create({
      data: {
        reference: `ENQ-QTEST-${Date.now()}`, source: "QUOTE_FORM", productsRequired: "pens and glue", leadId: lead.id,
        items: { create: [{ productId, productName: "QTest Pen", quantityNote: "25 boxes" }, { productName: "Mystery glue", quantityNote: "a lot" }] },
      },
    });
    const first = await q.createQuotationFromEnquiry(enquiry.id);
    const second = await q.createQuotationFromEnquiry(enquiry.id);
    expect(first.ok && second.ok && first.id === second.id).toBe(true);
    if (!first.ok) return;
    const quote = await db.quotation.findUniqueOrThrow({ where: { id: first.id }, include: { items: { orderBy: { id: "asc" } }, customer: true } });
    expect(quote).toMatchObject({ status: "DRAFT", enquiryId: enquiry.id, total: null });
    expect(quote.customer).toMatchObject({ organizationName: "QTest Sunrise School", contactName: "QTest Buyer", phone: "+9100000099001", billingCity: "Ranchi" });
    expect(quote.items.map((i) => [i.description, i.quantity, i.unit])).toEqual([["QTest Pen", 25, "box"], ["Mystery glue", 1, "pcs"]]);
    expect(quote.items.every((i) => i.unitPrice === null && i.priceSetBy === null)).toBe(true); // no price is invented
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).customerId).toBe(quote.customerId);
    expect((await db.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } })).status).toBe("IN_REVIEW");
    expect(await db.quotation.count({ where: { enquiryId: enquiry.id } })).toBe(1);
    expect(await q.createQuotationFromEnquiry("missing")).toMatchObject({ ok: false });
  });

  it("customers: create, validate phone and GSTIN, edit", async () => {
    const r = await customers.saveCustomer(null, { type: "SCHOOL", organizationName: "QTest College", contactName: "Ravi", phone: "98765 43210", gstin: "", email: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await db.customer.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ phone: "+919876543210", gstin: null, email: null, type: "SCHOOL" });
    expect(await customers.saveCustomer(r.id, { type: "SCHOOL", organizationName: "QTest College", contactName: "Ravi", phone: "12345" })).toMatchObject({ ok: false, fieldErrors: { phone: expect.any(String) } });
    expect(await customers.saveCustomer(r.id, { type: "SCHOOL", organizationName: "QTest College", contactName: "Ravi", phone: "9876543210", gstin: "not-a-gstin" })).toMatchObject({ ok: false, fieldErrors: { gstin: expect.any(String) } });
    expect(await customers.saveCustomer("missing", { type: "SCHOOL", organizationName: "QTest X", contactName: "Ravi", phone: "9876543210" })).toMatchObject({ ok: false });
  });
});
