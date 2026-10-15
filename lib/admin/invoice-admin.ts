import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getInvoiceSupplier } from "@/lib/business";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { clampPage } from "@/lib/db/paging";
import { appendOrderLog } from "@/lib/db/order-log";
import { allocateSequence } from "@/lib/db/sequence";
import {
  computeInvoiceTaxes,
  invoiceNumber,
  MAX_INVOICE_SEQUENCE,
  placeOfSupplyCode,
  placeOfSupplyLabel,
  stateByCode,
  stateByName,
  stateCodeFromGstin,
  taxModeFor,
  UTGST_CODES,
  type TaxMode,
} from "@/lib/domain/gst";
import { financialYearOf, formatRupees, fromPaise, MAX_RUPEES, toPaise } from "@/lib/domain/quote-math";
import { logLine } from "@/lib/domain/order-log";
import { joinAddress, type InvoiceSupplier } from "@/lib/domain/supplier";
import { isGstinCheckCharacterValid } from "@/lib/gstin";
import { fieldErrors } from "@/lib/validation/admin-catalogue";
import { invoiceDraftSchema, invoiceLineHsnSchema, reasonSchema, paymentSchema } from "@/lib/validation/admin-sales";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Admin data functions for GST invoices and payments. Every exported function calls requireAdmin() / requireOwner() first.
 *
 * Rules (see docs/ADMIN.md):
 *  • An invoice is drafted from a confirmed order — one live invoice per order. Staff may draft and edit a draft.
 *  • ISSUING is the OWNER's decision (the owner approves every commercial commitment). It allocates the next gap-free number of the
 *    financial year, splits the tax (CGST+SGST within the supplier's state, IGST otherwise), and freezes the buyer's and the
 *    seller's details on the invoice. After that the invoice can only change status (database rule).
 *  • The seller's GSTIN comes from the server environment, never from source code. Without it nothing can be issued.
 *  • Voiding is owner-only and only while no payment has been received. A voided invoice keeps its number.
 *  • Payments are recorded by a person against an issued invoice, never above what is still owed; a mistaken one is reversed
 *    (owner only), never deleted. The AI agent has no path into any of this, and nothing here sends a message or moves money.
 *  • Not handled — do these outside this system or ask the accountant: reverse charge, exports / SEZ, composition scheme,
 *    cess, TCS / TDS, UTGST (supplier in a Union Territory without legislature), e-invoicing (IRN) and e-way bills.
 */

export type IResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };
type Tx = Prisma.TransactionClient;

const PAGE_SIZE = 25;
export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"] as const;
/** Statuses in which an invoice is still being prepared (PENDING_APPROVAL is never produced by this system but is treated the same). */
const DRAFTISH: readonly string[] = ["DRAFT", "PENDING_APPROVAL"];
const ORDER_CAN_BE_INVOICED: readonly string[] = ["CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED"];
const GENERIC: IResult = { ok: false, message: "Could not save. Please try again." };
const fail = (error: unknown, what: string): IResult => {
  console.error(`[admin] ${what} failed:`, error instanceof Error ? error.message : "unknown");
  return GENERIC;
};
/** Thrown inside a transaction to refuse AND roll everything back (including a number already taken from the counter). */
class Refusal extends Error {}
const refresh = (invoiceId?: string, orderId?: string) => {
  revalidatePath("/admin");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  if (invoiceId) revalidatePath(`/admin/invoices/${invoiceId}`);
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
};

/** A Decimal as exact "1234.50" text. */
const money = (value: { toString(): string }) => {
  const paise = toPaise(value);
  return paise === null ? "0.00" : fromPaise(paise);
};
const paiseOf = (value: { toString(): string } | null | undefined) => toPaise(value) ?? 0n;

/** Locks the invoice row until the transaction ends, so two people can not issue / pay / void it at the same moment. */
async function lockInvoice(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
}
/** Locks the order row. Always taken AFTER the invoice lock (never the other way round), so the two can not deadlock. */
async function lockOrder(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
}

/** Why the seller's details can not go on an invoice, or null if they can. Checked at issue and shown on the draft. */
function supplierProblem(supplier: InvoiceSupplier): string | null {
  if (!supplier.gstin) return "The business GSTIN has not been set up on the server, so no invoice can be issued yet. See the invoicing section of docs/ADMIN.md.";
  const state = stateCodeFromGstin(supplier.gstin);
  if (!isGstinCheckCharacterValid(supplier.gstin) || !state) return "The business GSTIN set on the server does not pass its check (its last character does not match the rest), so it was probably mistyped. Correct it, redeploy and try again.";
  if (supplier.homeStateCode && supplier.homeStateCode !== state) {
    return `The business GSTIN is registered in ${stateByCode(state)?.name}, but the business address printed on invoices is in ${stateByCode(supplier.homeStateCode)?.name}. Check the GSTIN setting.`;
  }
  return null;
}

/**
 * A fingerprint of everything the owner looks at before issuing: the draft (place of supply, due date), the customer's record
 * (name, address, GSTIN) and each line's HSN. The issue form carries it, and issuing is refused if anything has changed since.
 */
function reviewKeyOf(invoice: { updatedAt: Date; placeOfSupply: string | null; dueDate: Date | null }, customerUpdatedAt: Date, items: { id: string; hsnCode: string | null }[]): string {
  const parts = [invoice.updatedAt.getTime(), invoice.placeOfSupply, invoice.dueDate?.getTime() ?? null, customerUpdatedAt.getTime(), ...items.map((i) => `${i.id}:${i.hsnCode ?? ""}`)];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

const istDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date); // YYYY-MM-DD

// ───────────────────────────── reading ─────────────────────────────

export async function listInvoices(params: { status?: string; q?: string; page?: number }) {
  await requireAdmin();
  const where: Prisma.InvoiceWhereInput = {};
  if ((INVOICE_STATUSES as readonly string[]).includes(params.status ?? "")) where.status = params.status as (typeof INVOICE_STATUSES)[number];
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { customer: { organizationName: { contains: q, mode: "insensitive" } } }, { order: { number: { contains: q, mode: "insensitive" } } }];
  const page = clampPage(params.page);
  const db = getDb();
  const [total, items] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { organizationName: true } }, order: { select: { number: true } } },
    }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Numbers for the dashboard: what needs someone's attention in orders and invoices. */
export async function getBillingCounts() {
  await requireAdmin();
  const db = getDb();
  const [ordersToConfirm, ordersInProgress, draftInvoices, unpaidInvoices] = await Promise.all([
    db.order.count({ where: { status: "PENDING_CONFIRMATION" } }),
    db.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING", "DISPATCHED"] } } }),
    // A draft on a cancelled order can never be issued, so it is not "waiting for anything".
    db.invoice.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL"] }, order: { status: { not: "CANCELLED" } } } }),
    db.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
  ]);
  return { ordersToConfirm, ordersInProgress, draftInvoices, unpaidInvoices };
}

/** Confirmed (or later) orders that have no live invoice yet. */
export async function listOrdersReadyToInvoice() {
  await requireAdmin();
  return getDb().order.findMany({
    where: { status: { in: ORDER_CAN_BE_INVOICED as never[] }, invoices: { none: { status: { not: "VOID" } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, status: true, total: true, customer: { select: { organizationName: true } } },
  });
}

/**
 * One invoice with everything the screens need: lines, payments, the tax split worked out from the stored lines, what has
 * been paid and what is still owed. For an issued invoice, `taxMatchesStored` says whether re-computing the tax gives the
 * same totals that were stored when it was issued (it always should; the print view warns if not).
 */
export async function getInvoice(id: string) {
  await requireAdmin();
  const invoice = await getDb().invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      order: { select: { id: true, number: true, status: true, total: true, createdAt: true, shippingLine1: true, shippingCity: true, shippingState: true, shippingPincode: true } },
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { recordedBy: { select: { name: true } } } },
    },
  });
  if (!invoice) return null;

  const issued = !DRAFTISH.includes(invoice.status);
  const supplier = getInvoiceSupplier();
  const supplierGstin = issued ? invoice.supplierGstin : supplier.gstin;
  const supplierState = stateCodeFromGstin(supplierGstin);
  const posCode = placeOfSupplyCode(invoice.placeOfSupply);
  const mode: TaxMode | null = supplierState && posCode ? taxModeFor(supplierState, posCode) : null;
  const tax = mode ? computeInvoiceTaxes(invoice.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice.toString(), gstRatePercent: i.gstRatePercent.toString() })), mode) : null;

  const paid = invoice.payments.filter((p) => p.status === "CONFIRMED").reduce((sum, p) => sum + paiseOf(p.amount), 0n);
  const totalPaise = issued ? paiseOf(invoice.total) : tax ? (toPaise(tax.total) ?? 0n) : 0n;
  // A void invoice is owed nothing.
  const outstanding = invoice.status !== "VOID" && totalPaise > paid ? totalPaise - paid : 0n;
  const taxMatchesStored = issued && tax !== null && money(invoice.subtotal) === tax.subtotal && money(invoice.cgstTotal) === tax.cgstTotal && money(invoice.sgstTotal) === tax.sgstTotal && money(invoice.igstTotal) === tax.igstTotal && money(invoice.total) === tax.total;

  const draftOnly = !issued;
  return {
    ...invoice,
    issued,
    mode,
    tax,
    taxMatchesStored,
    paid: fromPaise(paid),
    outstanding: fromPaise(outstanding),
    /** What the screens may say about the seller on a DRAFT (the number itself is only shown once issued). */
    supplierReady: Boolean(supplier.gstin),
    supplierStateName: stateByCode(stateCodeFromGstin(supplier.gstin))?.name ?? null,
    /** The place-of-supply the owner would get by default, to pre-select in the draft form. */
    placeOfSupplyCode: posCode,
    /** Why the seller's details can not be printed yet (drafts only), or null. */
    supplierProblem: draftOnly ? supplierProblem(supplier) : null,
    /** False when the customer's saved GSTIN fails its check character (a likely typo). */
    customerGstinOk: !invoice.customer.gstin || isGstinCheckCharacterValid(invoice.customer.gstin),
    /** The order's delivery address, for the "ship to" line and to compare with the place of supply. */
    deliveryAddress: joinAddress({ line1: invoice.order.shippingLine1, city: invoice.order.shippingCity, state: invoice.order.shippingState, pincode: invoice.order.shippingPincode }),
    deliveryState: stateByName(invoice.order.shippingState),
    orderUsable: ORDER_CAN_BE_INVOICED.includes(invoice.order.status),
    /** The first day a payment may be dated: the day the order was created. */
    minPaymentDate: istDay(invoice.order.createdAt),
    /** Sent back with the issue form; issuing is refused if the draft, the customer or an HSN changed since the page was opened. */
    reviewKey: reviewKeyOf(invoice, invoice.customer.updatedAt, invoice.items),
  };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

/** Issued invoices that are not fully paid, with what is still owed — the "who owes us" list. */
export async function listReceivables() {
  await requireAdmin();
  const db = getDb();
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { issueDate: "asc" }],
    take: 200,
    select: { id: true, number: true, issueDate: true, dueDate: true, total: true, status: true, customer: { select: { organizationName: true } } },
  });
  const sums = invoices.length
    ? await db.payment.groupBy({ by: ["invoiceId"], where: { status: "CONFIRMED", invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } })
    : [];
  const paidBy = new Map(sums.map((s) => [s.invoiceId, paiseOf(s._sum.amount)]));
  const today = istDay(new Date());
  return invoices.map((i) => {
    const paid = paidBy.get(i.id) ?? 0n;
    const owed = paiseOf(i.total) - paid;
    return { ...i, paid: fromPaise(paid), outstanding: fromPaise(owed > 0n ? owed : 0n), overdue: i.dueDate !== null && istDay(i.dueDate) < today };
  });
}

export async function listPayments(params: { page?: number }) {
  await requireAdmin();
  const page = clampPage(params.page);
  const db = getDb();
  const [total, items] = await Promise.all([
    db.payment.count(),
    db.payment.findMany({
      orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { invoice: { select: { id: true, number: true, customer: { select: { organizationName: true } } } }, recordedBy: { select: { name: true } } },
    }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ───────────────────────────── drafting ─────────────────────────────

/**
 * Where the goods are delivered decides the tax: the order's delivery state, else the customer's billing state, else the state in
 * their GSTIN. A state that is WRITTEN but not recognised ("WB" is, "Bengol" is not) gives NO default — falling through to the next
 * source could silently pick the wrong state — so the owner is asked to choose.
 */
function defaultPlaceOfSupply(order: { shippingState: string | null }, customer: { billingState: string | null; gstin: string | null }): string | null {
  const written = order.shippingState?.trim() || customer.billingState?.trim();
  const code = written ? stateByName(written)?.code : stateCodeFromGstin(customer.gstin);
  return code ? placeOfSupplyLabel(code) : null;
}

/**
 * Starts a DRAFT invoice from a confirmed order, copying its lines. Idempotent: if the order already has a draft, that draft is
 * returned. An order with an issued invoice gets no second one — void the first if it was wrong.
 */
export async function createInvoiceDraft(orderId: string): Promise<IResult> {
  await requireAdmin();
  try {
    const result = await getDb().$transaction(async (tx: Tx): Promise<IResult> => {
      // Two people clicking at once: whoever holds this lock goes first, the other then sees the first one's draft.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: "asc" } }, customer: true } });
      if (!order) return { ok: false, message: "That order no longer exists." };
      const live = await tx.invoice.findFirst({ where: { orderId, status: { not: "VOID" } }, select: { id: true, status: true, number: true } });
      if (live) return DRAFTISH.includes(live.status) ? { ok: true, id: live.id } : { ok: false, message: `This order already has invoice ${live.number}. Void it first if it was wrong.` };
      if (!ORDER_CAN_BE_INVOICED.includes(order.status)) return { ok: false, message: "An invoice can be made once the owner has confirmed the order (and not if it was cancelled)." };
      if (order.items.length === 0) return { ok: false, message: "This order has no items." };

      const invoice = await tx.invoice.create({
        data: {
          createdBy: "ADMIN",
          orderId: order.id,
          customerId: order.customerId,
          placeOfSupply: defaultPlaceOfSupply(order, order.customer),
          items: {
            create: order.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice.toString(),
              hsnCode: item.hsnCode,
              gstRatePercent: item.gstRatePercent.toString(),
              lineTotal: item.lineTotal.toString(),
              productId: item.productId,
            })),
          },
        },
        select: { id: true },
      });
      return { ok: true, id: invoice.id };
    });
    if (result.ok) {
      refresh(result.id, orderId);
    }
    return result;
  } catch (error) {
    return fail(error, "createInvoiceDraft");
  }
}

/** The things a draft still lets you decide: the place of supply (state) and an optional due date. */
export async function updateInvoiceDraft(id: string, raw: Record<string, string>): Promise<IResult> {
  await requireAdmin();
  const parsed = invoiceDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const label = placeOfSupplyLabel(parsed.data.placeOfSupplyCode);
  if (!label) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { placeOfSupplyCode: "Choose a state from the list" } };
  try {
    const db = getDb();
    const changed = await db.invoice.updateMany({
      where: { id, status: { in: DRAFTISH as never[] } },
      data: { placeOfSupply: label, dueDate: parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T23:59:59+05:30`) : null },
    });
    if (changed.count !== 1) return { ok: false, message: "Only a draft invoice can be edited." };
    refresh(id);
    return { ok: true, id };
  } catch (error) {
    return fail(error, "updateInvoiceDraft");
  }
}

/** The HSN code on a draft line. Like prices and GST rates, HSN codes are the owner's to enter. */
export async function setInvoiceLineHsn(lineId: string, raw: Record<string, string>): Promise<IResult> {
  const session = await requireAdmin();
  if (session.role !== "OWNER") return { ok: false, message: "Only the owner can change HSN codes." };
  const parsed = invoiceLineHsnSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const result = await getDb().$transaction(async (tx: Tx): Promise<IResult> => {
      const line = await tx.invoiceItem.findUnique({ where: { id: lineId }, select: { invoiceId: true } });
      if (!line) return { ok: false, message: "That line no longer exists." };
      await lockInvoice(tx, line.invoiceId); // an edit that overlaps an "issue" waits for it, then sees the invoice is issued
      const invoice = await tx.invoice.findUnique({ where: { id: line.invoiceId }, select: { status: true } });
      if (!invoice || !DRAFTISH.includes(invoice.status)) return { ok: false, message: "An issued invoice can not be changed." };
      await tx.invoiceItem.update({ where: { id: lineId }, data: { hsnCode: parsed.data.hsnCode } });
      return { ok: true, id: line.invoiceId };
    });
    if (result.ok) refresh(result.id);
    return result;
  } catch (error) {
    return fail(error, "setInvoiceLineHsn");
  }
}

// ───────────────────────────── issuing (OWNER only) ─────────────────────────────

/**
 * Issues a draft as a tax invoice: owner only, all-or-nothing. In one transaction it checks everything, takes the next number
 * of the year (so a refusal after that rolls the number back too), works out the tax, freezes the buyer's and seller's details
 * and marks it ISSUED. `reviewKey` is the fingerprint the issue form carried (see getInvoice): if the draft, the customer's
 * record or an HSN code changed after the owner opened the page, nothing is issued and the owner is asked to look again.
 */
export async function issueInvoice(id: string, reviewKey: string): Promise<IResult<{ id: string; number: string }>> {
  const session = await requireOwner();
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<IResult<{ id: string; number: string }>> => {
      // Locks, always in this order: the invoice, then its order. The order lock makes "cancel the order" and "issue its invoice"
      // wait for each other, so an invoice can never be issued on an order that has just been cancelled.
      await lockInvoice(tx, id);
      const head = await tx.invoice.findUnique({ where: { id }, select: { orderId: true } });
      if (!head) return { ok: false, message: "That invoice no longer exists." };
      await lockOrder(tx, head.orderId);

      // (Kept to two relations per query: a transaction has one connection, and Prisma runs a query's relation loads at the same time.)
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } }, customer: true } });
      if (!invoice) return { ok: false, message: "That invoice no longer exists." };
      if (!DRAFTISH.includes(invoice.status)) return { ok: false, message: "This invoice has already been issued." };
      const order = await tx.order.findUniqueOrThrow({ where: { id: invoice.orderId }, select: { status: true } });
      if (!ORDER_CAN_BE_INVOICED.includes(order.status)) return { ok: false, message: "The order is not confirmed (or was cancelled), so its invoice can not be issued." };
      if (invoice.items.length === 0) return { ok: false, message: "This invoice has no items." };
      if (reviewKeyOf(invoice, invoice.customer.updatedAt, invoice.items) !== reviewKey) {
        return { ok: false, message: "Something on this invoice or the customer's record changed after you opened the page. Reload it, check it again, then issue." };
      }

      const supplier = getInvoiceSupplier();
      const problem = supplierProblem(supplier);
      if (problem) return { ok: false, message: problem };
      const supplierState = stateCodeFromGstin(supplier.gstin)!;

      const posCode = placeOfSupplyCode(invoice.placeOfSupply);
      if (!posCode) return { ok: false, message: "Choose the place of supply (the state the goods are delivered to) and save, then issue." };
      const mode = taxModeFor(supplierState, posCode);
      if (mode === "INTRA_STATE" && UTGST_CODES.has(supplierState)) return { ok: false, message: "Supplies inside a Union Territory without a legislature carry UTGST, which this system does not handle. Please prepare this invoice outside the system." };

      const customer = invoice.customer;
      if (customer.gstin && !isGstinCheckCharacterValid(customer.gstin)) return { ok: false, message: "The customer's GSTIN does not pass its check (its last character does not match the rest), so it was probably mistyped. Correct it on the customer's page, then issue." };
      const buyerAddress = joinAddress({ line1: customer.billingLine1, city: customer.billingCity, state: customer.billingState, pincode: customer.billingPincode });
      if (!buyerAddress) return { ok: false, message: "The customer has no billing address. Add it on the customer's page, then issue." };

      const taxes = computeInvoiceTaxes(invoice.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice.toString(), gstRatePercent: i.gstRatePercent.toString() })), mode);
      if (!taxes) return { ok: false, message: "A line has a price, quantity or GST rate that can not be used. Check the order's items." };
      const totalPaise = toPaise(taxes.total);
      if (totalPaise === null || totalPaise > MAX_RUPEES * 100n + 99n) return { ok: false, message: "The invoice total is too large to record." };
      if (totalPaise === 0n) return { ok: false, message: "The invoice total is zero, so there is nothing to invoice. Check the prices on the order's items." };

      const now = new Date();
      if (invoice.dueDate && istDay(invoice.dueDate) < istDay(now)) return { ok: false, message: "The due date is before today. Change or clear it, then issue." };

      const financialYear = financialYearOf(now);
      const sequence = await allocateSequence(tx, "INV", financialYear);
      // From here a refusal must THROW, so the transaction rolls back and the number just taken goes back to the counter.
      if (sequence > MAX_INVOICE_SEQUENCE) throw new Refusal("This year's invoice numbers are used up.");
      const number = invoiceNumber(financialYear, sequence);

      const changed = await tx.invoice.updateMany({
        where: { id, status: { in: DRAFTISH as never[] } },
        data: {
          status: "ISSUED",
          number,
          financialYear,
          sequence,
          issueDate: now,
          subtotal: taxes.subtotal,
          cgstTotal: taxes.cgstTotal,
          sgstTotal: taxes.sgstTotal,
          igstTotal: taxes.igstTotal,
          total: taxes.total,
          buyerName: customer.organizationName,
          buyerAddress,
          buyerGstin: customer.gstin,
          placeOfSupply: placeOfSupplyLabel(posCode),
          supplierName: supplier.name,
          supplierAddress: supplier.address,
          supplierGstin: supplier.gstin,
        },
      });
      if (changed.count !== 1) throw new Refusal("The invoice was just changed by someone else. Reload and try again.");
      await appendOrderLog(tx, invoice.orderId, logLine(istDay(now), session.name, `invoice ${number} issued`));
      return { ok: true, id, number };
    });
    if (result.ok) {
      const row = await getDb().invoice.findUnique({ where: { id }, select: { orderId: true } });
      refresh(id, row?.orderId);
    }
    return result;
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, message: error.message };
    return fail(error, "issueInvoice") as IResult<{ id: string; number: string }>;
  }
}

// ───────────────────────────── voiding (OWNER only) ─────────────────────────────

/**
 * Cancels an issued invoice that has had no payment. The number stays used by the voided invoice (numbers are never reused);
 * the order can then be invoiced again. Who voided it, when and why is written to the order's log lines, which staff can not edit.
 */
export async function voidInvoice(id: string, raw: Record<string, string>): Promise<IResult> {
  const session = await requireOwner();
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please say why.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<IResult<{ id: string; orderId?: string }>> => {
      await lockInvoice(tx, id);
      const head = await tx.invoice.findUnique({ where: { id }, select: { orderId: true } });
      if (!head) return { ok: false, message: "That invoice no longer exists." };
      await lockOrder(tx, head.orderId);
      const invoice = await tx.invoice.findUnique({ where: { id }, select: { status: true, number: true, orderId: true, payments: { select: { status: true } } } });
      if (!invoice) return { ok: false, message: "That invoice no longer exists." };
      if (invoice.status !== "ISSUED") return { ok: false, message: invoice.status === "VOID" ? "This invoice is already void." : DRAFTISH.includes(invoice.status) ? "A draft has no number to cancel and is simply left unissued." : "An invoice with payments can not be voided. Reverse the payments first." };
      if (invoice.payments.some((p) => p.status === "CONFIRMED")) return { ok: false, message: "An invoice with payments can not be voided. Reverse the payments first." };
      await tx.invoice.update({ where: { id }, data: { status: "VOID" } });
      await appendOrderLog(tx, invoice.orderId, logLine(istDay(new Date()), session.name, `invoice ${invoice.number} voided — ${parsed.data.reason}`));
      return { ok: true, id, orderId: invoice.orderId };
    });
    if (result.ok) refresh(id, result.orderId);
    return result.ok ? { ok: true, id } : result;
  } catch (error) {
    return fail(error, "voidInvoice");
  }
}

// ───────────────────────────── payments ─────────────────────────────

/** The status an invoice should have, given what has been received. */
function statusFor(totalPaise: bigint, paidPaise: bigint): "ISSUED" | "PARTIALLY_PAID" | "PAID" {
  return paidPaise <= 0n ? "ISSUED" : paidPaise >= totalPaise ? "PAID" : "PARTIALLY_PAID";
}

/**
 * Records money that has ALREADY arrived (a person types it in). Never above what is still owed, and not dated before the order
 * existed or in the future. The invoice is locked while this runs, so two people can not each record "the last ₹5,000".
 * This never charges or sends anything.
 */
export async function recordPayment(invoiceId: string, raw: Record<string, string>): Promise<IResult> {
  const session = await requireAdmin();
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const amount = toPaise(input.amount);
  if (amount === null || amount <= 0n) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { amount: "Enter an amount in rupees, e.g. 5000 or 5000.50" } };
  const paidAt = new Date(`${input.paidOn}T12:00:00+05:30`);
  if (new Date(`${input.paidOn}T00:00:00+05:30`) > new Date()) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { paidOn: "That date is in the future" } };

  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<IResult<{ id: string; orderId?: string }>> => {
      await lockInvoice(tx, invoiceId);
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true, total: true, orderId: true, order: { select: { createdAt: true } }, payments: { where: { status: "CONFIRMED" }, select: { amount: true } } },
      });
      if (!invoice) return { ok: false, message: "That invoice no longer exists." };
      if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") return { ok: false, message: invoice.status === "PAID" ? "This invoice is already fully paid." : "Payments can only be recorded against an issued invoice." };
      if (input.paidOn < istDay(invoice.order.createdAt)) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { paidOn: `Not before ${istDay(invoice.order.createdAt)}, the day the order was created` } };
      const total = paiseOf(invoice.total);
      const paid = invoice.payments.reduce((sum, p) => sum + paiseOf(p.amount), 0n);
      const owed = total - paid;
      if (amount > owed) return { ok: false, message: `That is more than is owed. Outstanding: ${formatRupees(fromPaise(owed))}.`, fieldErrors: { amount: `At most ${formatRupees(fromPaise(owed))}` } };
      await tx.payment.create({
        data: { invoiceId, amount: fromPaise(amount), method: input.method, status: "CONFIRMED", reference: input.reference, paidAt, notes: input.notes, recordedById: session.userId },
      });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: statusFor(total, paid + amount) } });
      return { ok: true, id: invoiceId, orderId: invoice.orderId };
    });
    if (result.ok) refresh(invoiceId, result.orderId);
    return result.ok ? { ok: true, id: invoiceId } : result;
  } catch (error) {
    return fail(error, "recordPayment");
  }
}

/**
 * Marks a payment as reversed — entered by mistake, or a bounced cheque (stored as status FAILED). OWNER only. The payment row
 * stays, with who reversed it and why added to its notes; the invoice goes back to the status the remaining payments give it.
 */
export async function reversePayment(paymentId: string, raw: Record<string, string>): Promise<IResult> {
  const session = await requireOwner();
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please say why.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<IResult<{ id: string; orderId?: string }>> => {
      const found = await tx.payment.findUnique({ where: { id: paymentId }, select: { invoiceId: true } });
      if (!found) return { ok: false, message: "That payment no longer exists." };
      await lockInvoice(tx, found.invoiceId);
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, select: { status: true, notes: true, invoice: { select: { total: true, status: true, orderId: true } } } });
      if (!payment) return { ok: false, message: "That payment no longer exists." };
      if (payment.status !== "CONFIRMED") return { ok: false, message: "This payment is already reversed." };
      const note = `Reversed ${istDay(new Date())} by ${session.name}: ${parsed.data.reason}`;
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", notes: [payment.notes, note].filter(Boolean).join("\n").slice(-1000) } });
      const remaining = await tx.payment.findMany({ where: { invoiceId: found.invoiceId, status: "CONFIRMED" }, select: { amount: true } });
      const paid = remaining.reduce((sum, p) => sum + paiseOf(p.amount), 0n);
      await tx.invoice.update({ where: { id: found.invoiceId }, data: { status: statusFor(paiseOf(payment.invoice.total), paid) } });
      return { ok: true, id: found.invoiceId, orderId: payment.invoice.orderId };
    });
    if (result.ok) refresh(result.id, result.orderId);
    return result.ok ? { ok: true, id: result.id } : result;
  } catch (error) {
    return fail(error, "reversePayment");
  }
}
