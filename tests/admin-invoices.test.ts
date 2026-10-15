import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invoiceNumber } from "@/lib/domain/gst";
import { financialYearOf } from "@/lib/domain/quote-math";
import { buildSupplier, joinAddress } from "@/lib/domain/supplier";
import { invoiceDraftSchema, paymentSchema } from "@/lib/validation/admin-sales";

const url = process.env.TEST_DATABASE_URL;
const fy = () => financialYearOf(new Date());
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

describe("invoice helpers and validation", () => {
  it("builds the seller block from the supplied GSTIN and the owner's address; the legal name overrides the trading name", () => {
    const plain = buildSupplier({ gstin: "20ABCDE1234F1Z5" });
    expect(plain).toEqual({ gstin: "20ABCDE1234F1Z5", name: "Munna Pen Center", address: "Railway Cinema Road, Purana Bazar, Dhanbad, Jharkhand - 826001" });
    expect(buildSupplier({ gstin: null, legalName: "  Munna Pen Center & Co  " })).toMatchObject({ gstin: null, name: "Munna Pen Center & Co" });
    expect(buildSupplier({ gstin: null, legalName: "  " }).name).toBe("Munna Pen Center");
  });

  it("joins only the address parts that are known", () => {
    expect(joinAddress({ line1: "12 Main Road", city: "Dhanbad", state: "Jharkhand", pincode: "826001" })).toBe("12 Main Road, Dhanbad, Jharkhand - 826001");
    expect(joinAddress({ city: "Dhanbad" })).toBe("Dhanbad");
    expect(joinAddress({ pincode: "826001" })).toBe("826001");
    expect(joinAddress({})).toBe("");
  });

  it("validates the draft form and the payment form", () => {
    expect(invoiceDraftSchema.safeParse({ placeOfSupplyCode: "20", dueDate: "" })).toMatchObject({ success: true, data: { dueDate: null } });
    expect(invoiceDraftSchema.safeParse({ placeOfSupplyCode: "", dueDate: "" }).success).toBe(false);
    const base = { amount: "₹1,250.50", method: "UPI", reference: " 4455 ", paidOn: "2026-10-01", notes: "" };
    expect(paymentSchema.parse(base)).toMatchObject({ amount: "1250.50", reference: "4455", notes: null });
    for (const bad of [{ amount: "0" }, { amount: "-5" }, { amount: "12.345" }, { amount: "" }, { method: "BITCOIN" }, { paidOn: "yesterday" }, { paidOn: "2026-02-31" }]) {
      expect(paymentSchema.safeParse({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe.skipIf(!url)("invoices and payments on a real database", () => {
  let t: Awaited<ReturnType<typeof import("./helpers/sales-db").setupSalesDb>>;
  let customerId = "";

  beforeAll(async () => {
    const { setupSalesDb } = await import("./helpers/sales-db");
    t = await setupSalesDb(url!);
  });
  afterAll(async () => {
    await t.cleanup();
    await t.db.$disconnect();
  });
  beforeEach(async () => {
    await t.resetData();
    t.state.role = "OWNER";
    t.state.signedIn = true;
    t.state.businessGstin = (await import("./helpers/sales-db")).TEST_SUPPLIER_GSTIN;
    t.state.legalName = null;
    customerId = (await t.newCustomer({ gstin: "20AAAAA0000A1Z5" })).id;
  });

  /** A draft invoice for a fresh confirmed order. */
  async function draft(lines?: Parameters<typeof t.confirmedOrder>[1], customer = customerId) {
    const orderId = await t.confirmedOrder(customer, lines);
    const made = await t.invoices.createInvoiceDraft(orderId);
    if (!made.ok) throw new Error(`setup: ${made.message}`);
    return { orderId, id: made.id };
  }
  async function issued(lines?: Parameters<typeof t.confirmedOrder>[1], customer = customerId) {
    const d = await draft(lines, customer);
    const r = await t.invoices.issueInvoice(d.id);
    if (!r.ok) throw new Error(`setup: ${r.message}`);
    return { ...d, number: r.number };
  }
  const pay = (invoiceId: string, extra: Record<string, string> = {}) => t.invoices.recordPayment(invoiceId, { amount: "100", method: "UPI", reference: "UTR1", paidOn: today(), ...extra });

  it("refuses everyone who is not signed in", async () => {
    t.state.signedIn = false;
    const calls = [
      () => t.invoices.listInvoices({}),
      () => t.invoices.getInvoice("x"),
      () => t.invoices.listOrdersReadyToInvoice(),
      () => t.invoices.listReceivables(),
      () => t.invoices.listPayments({}),
      () => t.invoices.createInvoiceDraft("x"),
      () => t.invoices.updateInvoiceDraft("x", {}),
      () => t.invoices.setInvoiceLineHsn("x", {}),
      () => t.invoices.issueInvoice("x"),
      () => t.invoices.voidInvoice("x", {}),
      () => t.invoices.recordPayment("x", {}),
      () => t.invoices.reversePayment("x", {}),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow("NEXT_REDIRECT");
  });

  describe("drafting", () => {
    it("copies the order's lines and picks the place of supply from the delivery state", async () => {
      const d = await draft([{ description: "Blue pen", quantity: "10", unitPrice: "100.00", gstRatePercent: "18", hsnCode: "9608" }, { description: "Notebook", quantity: "3", unitPrice: "33.33", gstRatePercent: "12", hsnCode: "" }]);
      const inv = (await t.invoices.getInvoice(d.id))!;
      expect(inv).toMatchObject({ status: "DRAFT", number: null, placeOfSupply: "20-Jharkhand", createdBy: "ADMIN", customerId, orderId: d.orderId, issued: false });
      expect(inv.items.map((i) => [i.description, i.quantity, i.unitPrice.toString(), i.hsnCode, i.gstRatePercent.toString(), i.lineTotal.toString()])).toEqual([
        ["Blue pen", 10, "100", "9608", "18", "1000"],
        ["Notebook", 3, "33.33", null, "12", "99.99"],
      ]);
      expect(inv.mode).toBe("INTRA_STATE");
      expect(inv.supplierReady).toBe(true);
      expect(inv.supplierStateName).toBe("Jharkhand");
      // A draft shows a preview of the tax but nothing is stored yet.
      expect(inv.tax?.total).toBe("1291.99");
      expect(inv.total.toString()).toBe("0");
    });

    it("only a confirmed order can be invoiced", async () => {
      const quoteId = await t.acceptedQuote(customerId);
      const made = await t.orders.createOrderFromQuotation(quoteId);
      if (!made.ok) throw new Error("setup");
      expect(await t.invoices.createInvoiceDraft(made.id)).toMatchObject({ ok: false, message: expect.stringContaining("confirmed") });
      await t.orders.setOrderStatus(made.id, "CANCEL");
      expect(await t.invoices.createInvoiceDraft(made.id)).toMatchObject({ ok: false });
      expect(await t.invoices.createInvoiceDraft("nope")).toMatchObject({ ok: false });
      expect(await t.db.invoice.count({ where: { orderId: made.id } })).toBe(0);
    });

    it("is idempotent: clicking twice, or two people at once, gives one draft", async () => {
      const orderId = await t.confirmedOrder(customerId);
      const results = await Promise.all([1, 2, 3, 4].map(() => t.invoices.createInvoiceDraft(orderId)));
      expect(results.every((r) => r.ok)).toBe(true);
      expect(new Set(results.map((r) => (r.ok ? r.id : ""))).size).toBe(1);
      expect(await t.db.invoice.count({ where: { orderId } })).toBe(1);
    });

    it("staff can draft and set the place of supply and due date, but not change an HSN code", async () => {
      t.state.role = "STAFF";
      const d = await draft();
      expect(await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "09", dueDate: "2099-01-31" })).toMatchObject({ ok: true });
      expect(await t.invoices.getInvoice(d.id)).toMatchObject({ placeOfSupply: "09-Uttar Pradesh", mode: "INTER_STATE" });
      expect(await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "99", dueDate: "" })).toMatchObject({ ok: false, fieldErrors: { placeOfSupplyCode: expect.any(String) } });
      const line = (await t.invoices.getInvoice(d.id))!.items[0]!;
      expect(await t.invoices.setInvoiceLineHsn(line.id, { hsnCode: "9609" })).toMatchObject({ ok: false, message: expect.stringContaining("owner") });
      t.state.role = "OWNER";
      expect(await t.invoices.setInvoiceLineHsn(line.id, { hsnCode: "9609" })).toMatchObject({ ok: true });
      expect(await t.invoices.setInvoiceLineHsn(line.id, { hsnCode: "12" })).toMatchObject({ ok: false });
      expect((await t.invoices.getInvoice(d.id))!.items[0]!.hsnCode).toBe("9609");
    });
  });

  describe("issuing", () => {
    it("is for the owner only", async () => {
      const d = await draft();
      t.state.role = "STAFF";
      await expect(t.invoices.issueInvoice(d.id)).rejects.toThrow("NEXT_NOT_FOUND");
      expect((await t.invoices.getInvoice(d.id))!.status).toBe("DRAFT");
    });

    it("inside the supplier's state: CGST + SGST, numbered INV/yy-yy/0001, buyer and seller frozen on the invoice", async () => {
      t.state.legalName = "Munna Pen Center";
      const d = await draft([{ description: "Pen", quantity: "1", unitPrice: "10.10", gstRatePercent: "5", hsnCode: "9608" }, { description: "Ruler", quantity: "10", unitPrice: "100", gstRatePercent: "18", hsnCode: "9017" }]);
      const r = await t.invoices.issueInvoice(d.id);
      expect(r).toMatchObject({ ok: true });
      if (!r.ok) return;
      const [a, b] = fy().split("-");
      expect(r.number).toBe(invoiceNumber(fy(), 1));
      expect(r.number).toBe(`INV/${a!.slice(2)}-${b}/0001`);
      expect(r.number.length).toBeLessThanOrEqual(16);

      const inv = (await t.invoices.getInvoice(d.id))!;
      expect(inv).toMatchObject({ status: "ISSUED", number: r.number, financialYear: fy(), sequence: 1, issued: true, placeOfSupply: "20-Jharkhand", buyerGstin: "20AAAAA0000A1Z5", supplierGstin: "20ABCDE1234F1Z5", supplierName: "Munna Pen Center" });
      expect(inv.buyerName).toBe((await t.db.customer.findUniqueOrThrow({ where: { id: customerId } })).organizationName);
      expect(inv.buyerAddress).toBe("12 Main Road, Dhanbad, Jharkhand - 826001");
      expect(inv.supplierAddress).toBe("Railway Cinema Road, Purana Bazar, Dhanbad, Jharkhand - 826001");
      expect(inv.issueDate).toBeInstanceOf(Date);
      // 10.10 @ 5%: 2.5% = 0.2525 → 0.25 each side; 1000 @ 18%: 90 each side.
      expect([inv.subtotal, inv.cgstTotal, inv.sgstTotal, inv.igstTotal, inv.total].map((x) => x.toString())).toEqual(["1010.1", "90.25", "90.25", "0", "1190.6"]);
      expect(inv.mode).toBe("INTRA_STATE");
      expect(inv.taxMatchesStored).toBe(true);
      expect(inv.outstanding).toBe("1190.60");
    });

    it("outside the supplier's state: IGST only", async () => {
      const d = await draft([{ description: "Pen", quantity: "1", unitPrice: "10.10", gstRatePercent: "5" }, { description: "Ruler", quantity: "10", unitPrice: "100", gstRatePercent: "18" }]);
      await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "27", dueDate: "" });
      expect(await t.invoices.issueInvoice(d.id)).toMatchObject({ ok: true });
      const inv = (await t.invoices.getInvoice(d.id))!;
      // 10.10 @ 5% = 0.505 → 0.51 ; 1000 @ 18% = 180.
      expect([inv.cgstTotal, inv.sgstTotal, inv.igstTotal, inv.total].map((x) => x.toString())).toEqual(["0", "0", "180.51", "1190.61"]);
      expect(inv.placeOfSupply).toBe("27-Maharashtra");
      expect(inv.taxMatchesStored).toBe(true);
    });

    it("will not issue without the business GSTIN, and a refused attempt uses up no number", async () => {
      t.state.businessGstin = null;
      const a = await draft();
      expect(await t.invoices.issueInvoice(a.id)).toMatchObject({ ok: false, message: expect.stringContaining("GSTIN") });
      expect((await t.invoices.getInvoice(a.id))!.supplierReady).toBe(false);
      expect(await t.db.numberSequence.count({ where: { scope: "INV" } })).toBe(0);
      t.state.businessGstin = (await import("./helpers/sales-db")).TEST_SUPPLIER_GSTIN;
      expect(await t.invoices.issueInvoice(a.id)).toMatchObject({ ok: true, number: invoiceNumber(fy(), 1) });
    });

    it("refuses, and keeps the number free, when the place of supply, the buyer's address or the due date is wrong", async () => {
      const noAddress = await t.newCustomer({ billingLine1: null, billingCity: null, billingState: null, billingPincode: null });
      const a = await draft(undefined, noAddress.id);
      await t.invoices.updateInvoiceDraft(a.id, { placeOfSupplyCode: "20", dueDate: "" });
      expect(await t.invoices.issueInvoice(a.id)).toMatchObject({ ok: false, message: expect.stringContaining("billing address") });

      const noPlace = await t.newCustomer({ billingState: null });
      const orderId = await t.confirmedOrder(noPlace.id);
      await t.db.order.update({ where: { id: orderId }, data: { shippingState: null } });
      const b = await t.invoices.createInvoiceDraft(orderId);
      if (!b.ok) throw new Error("setup");
      expect((await t.invoices.getInvoice(b.id))!.placeOfSupply).toBeNull();
      expect(await t.invoices.issueInvoice(b.id)).toMatchObject({ ok: false, message: expect.stringContaining("place of supply") });

      const c = await draft();
      await t.invoices.updateInvoiceDraft(c.id, { placeOfSupplyCode: "20", dueDate: "2020-01-01" });
      expect(await t.invoices.issueInvoice(c.id)).toMatchObject({ ok: false, message: expect.stringContaining("due date") });

      expect(await t.db.numberSequence.count({ where: { scope: "INV" } })).toBe(0);
      await t.invoices.updateInvoiceDraft(c.id, { placeOfSupplyCode: "20", dueDate: "" });
      expect(await t.invoices.issueInvoice(c.id)).toMatchObject({ ok: true, number: invoiceNumber(fy(), 1) });
    });

    it("will not issue where UTGST would apply (seller in a Union Territory without a legislature, selling inside it)", async () => {
      t.state.businessGstin = "04ABCDE1234F1Z5"; // made up, state code 04 = Chandigarh
      const d = await draft();
      await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "04", dueDate: "" });
      expect(await t.invoices.issueInvoice(d.id)).toMatchObject({ ok: false, message: expect.stringContaining("UTGST") });
      await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "20", dueDate: "" });
      expect(await t.invoices.issueInvoice(d.id)).toMatchObject({ ok: true }); // leaving the territory is an ordinary IGST sale
      expect((await t.invoices.getInvoice(d.id))!.mode).toBe("INTER_STATE");
    });

    it("numbers invoices without gaps or repeats, even when issued at the same moment", async () => {
      const drafts = await Promise.all([1, 2, 3, 4, 5].map(() => draft()));
      const results = await Promise.all(drafts.map((d) => t.invoices.issueInvoice(d.id)));
      expect(results.every((r) => r.ok)).toBe(true);
      const rows = await t.db.invoice.findMany({ where: { customerId }, select: { number: true, sequence: true } });
      expect(rows.map((r) => r.sequence).sort()).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(rows.map((r) => r.number)).size).toBe(5);
    });

    it("can not be issued twice, and an issued invoice can not be changed — not even directly in the database", async () => {
      const d = await issued();
      expect(await t.invoices.issueInvoice(d.id)).toMatchObject({ ok: false, message: expect.stringContaining("already") });
      expect(await t.invoices.updateInvoiceDraft(d.id, { placeOfSupplyCode: "27", dueDate: "" })).toMatchObject({ ok: false });
      const line = (await t.invoices.getInvoice(d.id))!.items[0]!;
      expect(await t.invoices.setInvoiceLineHsn(line.id, { hsnCode: "9609" })).toMatchObject({ ok: false });
      await expect(t.db.invoice.update({ where: { id: d.id }, data: { total: "1.00" } })).rejects.toThrow();
      await expect(t.db.invoice.update({ where: { id: d.id }, data: { number: "INV/99-99/0001" } })).rejects.toThrow();
      await expect(t.db.invoiceItem.update({ where: { id: line.id }, data: { unitPrice: "1.00" } })).rejects.toThrow();
      await expect(t.db.invoice.delete({ where: { id: d.id } })).rejects.toThrow();
    });

    it("only one live invoice per order; after a void the order can be invoiced again with the next number", async () => {
      const first = await issued();
      expect(await t.invoices.createInvoiceDraft(first.orderId)).toMatchObject({ ok: false, message: expect.stringContaining(first.number) });
      expect(await t.invoices.voidInvoice(first.id, { reason: "Wrong rate on line 1" })).toMatchObject({ ok: true });
      const second = await t.invoices.createInvoiceDraft(first.orderId);
      expect(second).toMatchObject({ ok: true });
      if (!second.ok) return;
      expect(second.id).not.toBe(first.id);
      expect(await t.invoices.issueInvoice(second.id)).toMatchObject({ ok: true, number: invoiceNumber(fy(), 2) });
      expect(await t.db.invoice.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: "VOID", number: first.number });
    });
  });

  describe("voiding", () => {
    it("is for the owner, needs a reason, and writes the reason to the order's notes", async () => {
      const d = await issued();
      expect(await t.invoices.voidInvoice(d.id, { reason: "" })).toMatchObject({ ok: false });
      t.state.role = "STAFF";
      await expect(t.invoices.voidInvoice(d.id, { reason: "oops" })).rejects.toThrow("NEXT_NOT_FOUND");
      t.state.role = "OWNER";
      expect(await t.invoices.voidInvoice(d.id, { reason: "Issued to the wrong customer" })).toMatchObject({ ok: true });
      const order = await t.db.order.findUniqueOrThrow({ where: { id: d.orderId } });
      expect(order.notes).toContain(d.number);
      expect(order.notes).toContain("Issued to the wrong customer");
      expect(await t.invoices.voidInvoice(d.id, { reason: "again" })).toMatchObject({ ok: false, message: expect.stringContaining("already void") });
    });

    it("a draft is not voided (it has no number to cancel); a paid invoice is not voided until its payments are reversed", async () => {
      const d = await draft();
      expect(await t.invoices.voidInvoice(d.id, { reason: "not needed" })).toMatchObject({ ok: false });
      const i = await issued();
      expect(await pay(i.id)).toMatchObject({ ok: true });
      expect(await t.invoices.voidInvoice(i.id, { reason: "mistake" })).toMatchObject({ ok: false, message: expect.stringContaining("payments") });
      const payment = (await t.invoices.getInvoice(i.id))!.payments[0]!;
      expect(await t.invoices.reversePayment(payment.id, { reason: "entered twice" })).toMatchObject({ ok: true });
      expect(await t.invoices.voidInvoice(i.id, { reason: "mistake" })).toMatchObject({ ok: true });
    });

    it("an order with an issued invoice can not be cancelled until the invoice is voided", async () => {
      const i = await issued();
      expect(await t.orders.setOrderStatus(i.orderId, "CANCEL")).toMatchObject({ ok: false, message: expect.stringContaining("Void the invoice") });
      await t.invoices.voidInvoice(i.id, { reason: "customer withdrew" });
      expect(await t.orders.setOrderStatus(i.orderId, "CANCEL")).toMatchObject({ ok: true });
    });
  });

  describe("payments", () => {
    it("moves ISSUED → PARTIALLY_PAID → PAID, never above what is owed", async () => {
      const i = await issued([{ description: "Pen", quantity: "10", unitPrice: "100", gstRatePercent: "18" }]); // 1180.00 (590 + ...)
      expect((await t.invoices.getInvoice(i.id))!.outstanding).toBe("1180.00");
      expect(await pay(i.id, { amount: "480.50" })).toMatchObject({ ok: true });
      let inv = (await t.invoices.getInvoice(i.id))!;
      expect(inv).toMatchObject({ status: "PARTIALLY_PAID", paid: "480.50", outstanding: "699.50" });
      expect(await pay(i.id, { amount: "699.51" })).toMatchObject({ ok: false, message: expect.stringContaining("699.50"), fieldErrors: { amount: expect.any(String) } });
      expect(await pay(i.id, { amount: "699.50", method: "BANK_TRANSFER", reference: "UTR778" })).toMatchObject({ ok: true });
      inv = (await t.invoices.getInvoice(i.id))!;
      expect(inv).toMatchObject({ status: "PAID", paid: "1180.00", outstanding: "0.00" });
      expect(await pay(i.id, { amount: "1" })).toMatchObject({ ok: false, message: expect.stringContaining("fully paid") });
      expect(inv.payments.map((p) => [p.amount.toString(), p.method, p.status, p.recordedBy?.name])).toEqual([["480.5", "UPI", "CONFIRMED", "STest Owner"], ["699.5", "BANK_TRANSFER", "CONFIRMED", "STest Owner"]]);
    });

    it("staff can record a payment; a draft or void invoice can not be paid; a future date is refused", async () => {
      const i = await issued();
      t.state.role = "STAFF";
      expect(await pay(i.id)).toMatchObject({ ok: true });
      expect(await pay(i.id, { paidOn: "2999-01-01" })).toMatchObject({ ok: false, fieldErrors: { paidOn: expect.any(String) } });
      expect(await pay(i.id, { amount: "0" })).toMatchObject({ ok: false, fieldErrors: { amount: expect.any(String) } });
      const d = await draft();
      expect(await pay(d.id)).toMatchObject({ ok: false, message: expect.stringContaining("issued") });
      expect(await pay("no-such-invoice")).toMatchObject({ ok: false });
      t.state.role = "OWNER";
      const v = await issued();
      await t.invoices.voidInvoice(v.id, { reason: "mistake" });
      expect(await pay(v.id)).toMatchObject({ ok: false });
    });

    it("three people recording the whole amount at the same moment: exactly one succeeds, nothing is overpaid", async () => {
      const i = await issued([{ description: "Pen", quantity: "1", unitPrice: "1000", gstRatePercent: "18" }]); // 1180.00
      const results = await Promise.all([1, 2, 3].map(() => pay(i.id, { amount: "1180" })));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await t.db.payment.count({ where: { invoiceId: i.id, status: "CONFIRMED" } })).toBe(1);
      expect((await t.invoices.getInvoice(i.id))!.status).toBe("PAID");
    });

    it("a mistaken payment is reversed by the owner only; the row stays with the reason, and the invoice status follows", async () => {
      const i = await issued([{ description: "Pen", quantity: "1", unitPrice: "1000", gstRatePercent: "18" }]);
      await pay(i.id, { amount: "500" });
      await pay(i.id, { amount: "680" });
      expect((await t.invoices.getInvoice(i.id))!.status).toBe("PAID");
      const [first, second] = (await t.invoices.getInvoice(i.id))!.payments;
      t.state.role = "STAFF";
      await expect(t.invoices.reversePayment(second!.id, { reason: "cheque bounced" })).rejects.toThrow("NEXT_NOT_FOUND");
      t.state.role = "OWNER";
      expect(await t.invoices.reversePayment(second!.id, { reason: "" })).toMatchObject({ ok: false });
      expect(await t.invoices.reversePayment(second!.id, { reason: "cheque bounced" })).toMatchObject({ ok: true });
      let inv = (await t.invoices.getInvoice(i.id))!;
      expect(inv).toMatchObject({ status: "PARTIALLY_PAID", paid: "500.00", outstanding: "680.00" });
      const reversed = inv.payments.find((p) => p.id === second!.id)!;
      expect(reversed.status).toBe("FAILED");
      expect(reversed.notes).toContain("cheque bounced");
      expect(await t.invoices.reversePayment(second!.id, { reason: "again" })).toMatchObject({ ok: false, message: expect.stringContaining("already") });
      expect(await t.invoices.reversePayment(first!.id, { reason: "wrong invoice" })).toMatchObject({ ok: true });
      inv = (await t.invoices.getInvoice(i.id))!;
      expect(inv).toMatchObject({ status: "ISSUED", paid: "0.00", outstanding: "1180.00" });
      expect(await t.invoices.reversePayment("nope", { reason: "x" })).toMatchObject({ ok: false });
      await expect(t.db.payment.delete({ where: { id: first!.id } })).rejects.toThrow();
    });
  });

  describe("lists", () => {
    it("lists invoices, receivables with overdue flags, payments, and orders waiting for an invoice", async () => {
      const ready = await t.confirmedOrder(customerId);
      expect((await t.invoices.listOrdersReadyToInvoice()).map((o) => o.id)).toContain(ready);
      const a = await issued([{ description: "Pen", quantity: "1", unitPrice: "1000", gstRatePercent: "18" }]);
      await pay(a.id, { amount: "300" });
      const overdue = await draft();
      await t.invoices.updateInvoiceDraft(overdue.id, { placeOfSupplyCode: "20", dueDate: today() });
      await t.invoices.issueInvoice(overdue.id);
      await t.db.invoice.update({ where: { id: overdue.id }, data: {} }); // no-op; due date is end of today, so not overdue yet
      const receivables = (await t.invoices.listReceivables()).filter((r) => [a.id, overdue.id].includes(r.id));
      expect(receivables.find((r) => r.id === a.id)).toMatchObject({ status: "PARTIALLY_PAID", paid: "300.00", outstanding: "880.00", overdue: false });
      expect(receivables.find((r) => r.id === overdue.id)?.overdue).toBe(false);

      const listed = await t.invoices.listInvoices({ q: a.number });
      expect(listed.items.map((x) => x.id)).toEqual([a.id]);
      expect((await t.invoices.listInvoices({ status: "PARTIALLY_PAID" })).items.map((x) => x.id)).toContain(a.id);
      expect((await t.invoices.listInvoices({ status: "BOGUS", page: -1 })).page).toBe(1);
      expect((await t.invoices.listPayments({})).items.some((p) => p.invoice.id === a.id)).toBe(true);
    });
  });
});
