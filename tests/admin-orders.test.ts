import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { orderNumber, financialYearOf } from "@/lib/domain/quote-math";
import { ORDER_ACTIONS, dispatchSchema, orderDetailsSchema } from "@/lib/validation/admin-sales";

const url = process.env.TEST_DATABASE_URL;

describe("order validation", () => {
  it("numbers orders like quotations: ORD-<financial year>-<serial>", () => {
    expect(orderNumber("2026-27", 7)).toBe("ORD-2026-27-0007");
  });

  it("treats blank delivery and transport fields as unknown (null), and rejects a bad PIN code", () => {
    expect(orderDetailsSchema.parse({ shippingLine1: " ", shippingCity: "", shippingState: "", shippingPincode: "", notes: "" })).toEqual({
      shippingLine1: null, shippingCity: null, shippingState: null, shippingPincode: null, notes: null,
    });
    expect(orderDetailsSchema.safeParse({ shippingPincode: "8260" }).success).toBe(false);
    expect(dispatchSchema.parse({ transporter: "", trackingReference: " LR-1 " })).toEqual({ transporter: null, trackingReference: "LR-1" });
    expect(ORDER_ACTIONS).toEqual(["CONFIRM", "PROCESS", "DISPATCH", "DELIVER", "CANCEL"]);
  });
});

describe.skipIf(!url)("orders on a real database", () => {
  let t: Awaited<ReturnType<typeof import("./helpers/sales-db").setupSalesDb>>;

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
  });

  it("refuses everyone who is not signed in", async () => {
    t.state.signedIn = false;
    await expect(t.orders.listOrders({})).rejects.toThrow("NEXT_REDIRECT");
    await expect(t.orders.getOrder("x")).rejects.toThrow("NEXT_REDIRECT");
    await expect(t.orders.createOrderFromQuotation("x")).rejects.toThrow("NEXT_REDIRECT");
    await expect(t.orders.setOrderStatus("x", "CONFIRM")).rejects.toThrow("NEXT_REDIRECT");
    await expect(t.orders.updateOrderDetails("x", {})).rejects.toThrow("NEXT_REDIRECT");
    await expect(t.orders.listQuotationsAwaitingOrder()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("copies an accepted quotation exactly: lines, totals, delivery address (shipping first, else billing)", async () => {
    const customer = await t.newCustomer();
    const quoteId = await t.acceptedQuote(customer.id, [
      { description: "Blue pen", quantity: "10", unitPrice: "100.00", gstRatePercent: "18", hsnCode: "9608" },
      { description: "Notebook", quantity: "3", unitPrice: "33.33", gstRatePercent: "12", hsnCode: "" },
    ]);
    const made = await t.orders.createOrderFromQuotation(quoteId);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const order = await t.orders.getOrder(made.id);
    expect(order).toMatchObject({ status: "PENDING_CONFIRMATION", createdBy: "ADMIN", quotationId: quoteId, customerId: customer.id });
    expect(order!.number).toBe(orderNumber(financialYearOf(new Date()), 1));
    // 1000.00 @18% = 180.00 ; 99.99 @12% = 12.00 (11.9988 → 12.00)
    expect(order!.subtotal.toString()).toBe("1099.99");
    expect(order!.taxTotal.toString()).toBe("192");
    expect(order!.total.toString()).toBe("1291.99");
    expect(order!.items.map((i) => [i.description, i.quantity, i.unit, i.unitPrice.toString(), i.hsnCode, i.gstRatePercent.toString(), i.lineTotal.toString()])).toEqual([
      ["Blue pen", 10, "box", "100", "9608", "18", "1000"],
      ["Notebook", 3, "box", "33.33", null, "12", "99.99"],
    ]);
    expect(order).toMatchObject({ shippingLine1: "12 Main Road", shippingCity: "Dhanbad", shippingState: "Jharkhand", shippingPincode: "826001" });

    const shipped = await t.newCustomer({ shippingLine1: "Godown 4", shippingCity: "Bokaro", shippingState: "Jharkhand", shippingPincode: "827001" });
    const other = await t.orders.createOrderFromQuotation(await t.acceptedQuote(shipped.id));
    if (!other.ok) throw new Error("setup");
    expect(await t.orders.getOrder(other.id)).toMatchObject({ shippingLine1: "Godown 4", shippingCity: "Bokaro", shippingPincode: "827001" });
  });

  it("only accepted quotations can become orders", async () => {
    const customer = await t.newCustomer();
    const draft = await t.quotes.createQuotationForCustomer(customer.id);
    if (!draft.ok) throw new Error("setup");
    expect(await t.orders.createOrderFromQuotation(draft.id)).toMatchObject({ ok: false });
    await t.quotes.addQuotationLine(draft.id, { description: "Pen", quantity: "1", unit: "pcs", unitPrice: "10", gstRatePercent: "18" });
    await t.quotes.setQuotationStatus(draft.id, "SENT");
    expect(await t.orders.createOrderFromQuotation(draft.id)).toMatchObject({ ok: false, message: expect.stringContaining("accepted") });
    expect(await t.orders.createOrderFromQuotation("no-such-quotation")).toMatchObject({ ok: false });
    expect(await t.db.order.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it("is idempotent, even when several people click at the same moment: one order per quotation", async () => {
    const customer = await t.newCustomer();
    const quoteId = await t.acceptedQuote(customer.id);
    const results = await Promise.all([1, 2, 3, 4].map(() => t.orders.createOrderFromQuotation(quoteId)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.id : ""))).size).toBe(1);
    expect(await t.db.order.count({ where: { quotationId: quoteId } })).toBe(1);
    expect(await t.db.orderItem.count({ where: { order: { quotationId: quoteId } } })).toBe(1);
  });

  it("numbers orders without gaps or repeats", async () => {
    const customer = await t.newCustomer();
    const quotes = await Promise.all([1, 2, 3, 4, 5].map(() => t.acceptedQuote(customer.id)));
    const results = await Promise.all(quotes.map((id) => t.orders.createOrderFromQuotation(id)));
    expect(results.every((r) => r.ok)).toBe(true);
    const rows = await t.db.order.findMany({ where: { customerId: customer.id }, select: { number: true } });
    const serials = rows.map((r) => Number(r.number.slice(-4))).sort((a, b) => a - b);
    expect(serials).toHaveLength(5);
    expect(new Set(serials).size).toBe(5);
    expect(serials[4]! - serials[0]!).toBe(4); // consecutive
  });

  it("follows the flow: owner confirms, staff process / dispatch / deliver, with timestamps", async () => {
    const customer = await t.newCustomer();
    const made = await t.orders.createOrderFromQuotation(await t.acceptedQuote(customer.id));
    if (!made.ok) throw new Error("setup");

    // Staff can not confirm or cancel.
    t.state.role = "STAFF";
    expect(await t.orders.setOrderStatus(made.id, "CONFIRM")).toMatchObject({ ok: false, message: expect.stringContaining("owner") });
    expect(await t.orders.setOrderStatus(made.id, "CANCEL")).toMatchObject({ ok: false, message: expect.stringContaining("owner") });
    expect((await t.orders.getOrder(made.id))!.status).toBe("PENDING_CONFIRMATION");

    t.state.role = "OWNER";
    expect(await t.orders.setOrderStatus(made.id, "PROCESS")).toMatchObject({ ok: false }); // not confirmed yet
    expect(await t.orders.setOrderStatus(made.id, "DELIVER")).toMatchObject({ ok: false });
    expect(await t.orders.setOrderStatus(made.id, "CONFIRM")).toMatchObject({ ok: true });
    expect((await t.orders.getOrder(made.id))!.confirmedAt).toBeInstanceOf(Date);

    t.state.role = "STAFF";
    expect(await t.orders.setOrderStatus(made.id, "PROCESS")).toMatchObject({ ok: true });
    expect(await t.orders.setOrderStatus(made.id, "DISPATCH", { transporter: "  Sharma Roadlines ", trackingReference: "LR-4471" })).toMatchObject({ ok: true });
    expect(await t.orders.setOrderStatus(made.id, "CANCEL")).toMatchObject({ ok: false }); // staff
    t.state.role = "OWNER";
    expect(await t.orders.setOrderStatus(made.id, "CANCEL")).toMatchObject({ ok: false }); // too late: it has left
    expect(await t.orders.setOrderStatus(made.id, "DELIVER")).toMatchObject({ ok: true });

    const done = (await t.orders.getOrder(made.id))!;
    expect(done).toMatchObject({ status: "DELIVERED", transporter: "Sharma Roadlines", trackingReference: "LR-4471" });
    expect([done.confirmedAt, done.dispatchedAt, done.deliveredAt].every((d) => d instanceof Date)).toBe(true);
    expect(await t.orders.setOrderStatus(made.id, "DELIVER")).toMatchObject({ ok: false });
    expect(await t.orders.setOrderStatus(made.id, "NOPE")).toMatchObject({ ok: false, message: "Unknown action." });
    // Every step leaves a dated line saying who did it, in the part of the notes that staff can not edit.
    const log = ((await t.orders.getOrder(made.id))!.notes ?? "").split("\n").filter((l) => l.startsWith("[log] "));
    expect(log.map((l) => l.replace(/^\[log\] \d{4}-\d{2}-\d{2} STest Owner: /, ""))).toEqual(["order confirmed", "processing started", "marked as dispatched", "marked as delivered"]);
  });

  it("the owner can cancel before dispatch, and a cancelled order stays cancelled", async () => {
    const customer = await t.newCustomer();
    const made = await t.orders.createOrderFromQuotation(await t.acceptedQuote(customer.id));
    if (!made.ok) throw new Error("setup");
    expect(await t.orders.setOrderStatus(made.id, "CANCEL")).toMatchObject({ ok: true });
    expect(await t.orders.setOrderStatus(made.id, "CONFIRM")).toMatchObject({ ok: false });
    expect(await t.orders.setOrderStatus(made.id, "CANCEL")).toMatchObject({ ok: false });
    expect((await t.orders.getOrder(made.id))!.status).toBe("CANCELLED");
  });

  it("two people confirming at the same moment: exactly one succeeds", async () => {
    const customer = await t.newCustomer();
    const made = await t.orders.createOrderFromQuotation(await t.acceptedQuote(customer.id));
    if (!made.ok) throw new Error("setup");
    const results = await Promise.all([1, 2, 3].map(() => t.orders.setOrderStatus(made.id, "CONFIRM")));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("delivery address and notes are editable until the goods leave", async () => {
    const customer = await t.newCustomer();
    const made = await t.orders.createOrderFromQuotation(await t.acceptedQuote(customer.id));
    if (!made.ok) throw new Error("setup");
    t.state.role = "STAFF";
    expect(await t.orders.updateOrderDetails(made.id, { shippingLine1: "Plot 9", shippingCity: "Ranchi", shippingState: "Jharkhand", shippingPincode: "834001", notes: "Call before delivery" })).toMatchObject({ ok: true });
    expect(await t.orders.getOrder(made.id)).toMatchObject({ shippingLine1: "Plot 9", shippingCity: "Ranchi", notes: "Call before delivery" });
    expect(await t.orders.updateOrderDetails(made.id, { shippingPincode: "12" })).toMatchObject({ ok: false, fieldErrors: { shippingPincode: expect.any(String) } });
    await t.db.order.update({ where: { id: made.id }, data: { status: "DISPATCHED" } });
    expect(await t.orders.updateOrderDetails(made.id, { shippingCity: "Elsewhere" })).toMatchObject({ ok: false });
  });

  it("lists and filters orders, and lists accepted quotations still waiting for an order", async () => {
    const customer = await t.newCustomer();
    const a = await t.acceptedQuote(customer.id);
    const b = await t.acceptedQuote(customer.id);
    const made = await t.orders.createOrderFromQuotation(a);
    if (!made.ok) throw new Error("setup");
    const waiting = (await t.orders.listQuotationsAwaitingOrder()).map((x) => x.id);
    expect(waiting).toContain(b);
    expect(waiting).not.toContain(a);
    const listed = await t.orders.listOrders({ q: customer.organizationName });
    expect(listed.items.map((o) => o.id)).toEqual([made.id]);
    expect((await t.orders.listOrders({ status: "CONFIRMED", q: customer.organizationName })).items).toHaveLength(0);
    expect((await t.orders.listOrders({ status: "PENDING_CONFIRMATION", q: customer.organizationName })).total).toBe(1);
    expect((await t.orders.listOrders({ status: "BOGUS", page: -3 })).page).toBe(1);
  });

  it("an order's lines can not be edited or deleted through the database either (orders are never deleted)", async () => {
    const customer = await t.newCustomer();
    const made = await t.orders.createOrderFromQuotation(await t.acceptedQuote(customer.id));
    if (!made.ok) throw new Error("setup");
    await expect(t.db.order.delete({ where: { id: made.id } })).rejects.toThrow();
  });
});
