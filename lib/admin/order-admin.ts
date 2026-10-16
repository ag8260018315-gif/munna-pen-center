import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { clampPage } from "@/lib/db/paging";
import { appendOrderLog } from "@/lib/db/order-log";
import { allocateSequence } from "@/lib/db/sequence";
import { cleanUserNotes, joinNotes, logLine, splitNotes } from "@/lib/domain/order-log";
import { computeQuote, financialYearOf, orderNumber } from "@/lib/domain/quote-math";
import { fieldErrors } from "@/lib/validation/admin-catalogue";
import { dispatchSchema, ORDER_ACTIONS, orderDetailsSchema, type OrderAction } from "@/lib/validation/admin-sales";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Admin data functions for orders. Every exported function calls requireAdmin() first.
 *
 * Rules (see docs/ADMIN.md):
 *  • An order is created from an ACCEPTED quotation (one order per quotation). The quotation's lines and totals are
 *    copied once; after that the order's lines are read-only — a change of price or quantity means a new quotation.
 *  • Confirming and cancelling an order are the OWNER's decisions. Staff can move a confirmed order along
 *    (processing → dispatched → delivered) and keep the delivery address and notes up to date.
 *  • An order with an issued invoice can not be cancelled — the invoice must be voided first.
 *  • Nothing here changes stock, sends a message to the customer, or touches money.
 *  • Orders are never deleted (also enforced by a database trigger).
 */

export type OResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };
type Tx = Prisma.TransactionClient;

const PAGE_SIZE = 25;
export const ORDER_STATUSES = ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"] as const;
const GENERIC: OResult = { ok: false, message: "Could not save. Please try again." };
const fail = (error: unknown, what: string): OResult => {
  console.error(`[admin] ${what} failed:`, error instanceof Error ? error.message : "unknown");
  return GENERIC;
};
const istDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date); // YYYY-MM-DD
/** Locks the order row until the transaction ends: everything that decides what an order may do (cancel, edit, invoice) goes through this lock. */
async function lockOrder(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
}
const refresh = (id?: string) => {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  if (id) revalidatePath(`/admin/orders/${id}`);
};

// ───────────────────────────── reading ─────────────────────────────

export async function listOrders(params: { status?: string; q?: string; page?: number }) {
  await requireAdmin();
  const where: Prisma.OrderWhereInput = {};
  if ((ORDER_STATUSES as readonly string[]).includes(params.status ?? "")) where.status = params.status as (typeof ORDER_STATUSES)[number];
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { customer: { organizationName: { contains: q, mode: "insensitive" } } }];
  const page = clampPage(params.page);
  const db = getDb();
  const [total, items] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { organizationName: true } }, _count: { select: { items: true } } },
    }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getOrder(id: string) {
  await requireAdmin();
  return getDb().order.findUnique({
    where: { id },
    include: {
      customer: true,
      quotation: { select: { id: true, number: true } },
      items: { orderBy: { id: "asc" } },
      invoices: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, total: true, issueDate: true, createdAt: true } },
    },
  });
}

/** Accepted quotations that have no order yet — the "ready to turn into an order" list. */
export async function listQuotationsAwaitingOrder() {
  await requireAdmin();
  return getDb().quotation.findMany({
    where: { status: "ACCEPTED", order: { is: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, total: true, customer: { select: { organizationName: true } } },
  });
}

// ───────────────────────────── creating ─────────────────────────────

/** The delivery address: the customer's shipping address if they have one, else their billing address. */
function deliveryAddress(c: { billingLine1: string | null; billingCity: string | null; billingState: string | null; billingPincode: string | null; shippingLine1: string | null; shippingCity: string | null; shippingState: string | null; shippingPincode: string | null }) {
  const hasShipping = Boolean(c.shippingLine1 || c.shippingCity || c.shippingState || c.shippingPincode);
  return hasShipping
    ? { shippingLine1: c.shippingLine1, shippingCity: c.shippingCity, shippingState: c.shippingState, shippingPincode: c.shippingPincode }
    : { shippingLine1: c.billingLine1, shippingCity: c.billingCity, shippingState: c.billingState, shippingPincode: c.billingPincode };
}

/**
 * Turns an ACCEPTED quotation into an order. Idempotent: a second click (or a second person) gets the order that
 * already exists. The quotation's lines are frozen once it is accepted, so the copy is exact.
 */
export async function createOrderFromQuotation(quotationId: string): Promise<OResult> {
  await requireAdmin();
  try {
    const db = getDb();
    const existing = await db.order.findUnique({ where: { quotationId }, select: { id: true } });
    if (existing) return { ok: true, id: existing.id };

    const result = await db.$transaction(async (tx: Tx): Promise<OResult> => {
      const quotation = await tx.quotation.findUnique({ where: { id: quotationId }, include: { items: { orderBy: { id: "asc" } }, customer: true } });
      if (!quotation) return { ok: false, message: "That quotation no longer exists." };
      if (quotation.status !== "ACCEPTED") return { ok: false, message: "An order can only be created from an accepted quotation." };

      const math = computeQuote(quotation.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice?.toString() ?? null, gstRatePercent: i.gstRatePercent?.toString() ?? null })));
      if (math.overflow || math.subtotal === null || math.taxTotal === null || math.total === null) return { ok: false, message: "This quotation is not fully priced, so it can not become an order." };

      const financialYear = financialYearOf(new Date());
      const order = await tx.order.create({
        data: {
          number: orderNumber(financialYear, await allocateSequence(tx, "ORD", financialYear)),
          createdBy: "ADMIN",
          subtotal: math.subtotal,
          taxTotal: math.taxTotal,
          total: math.total,
          ...deliveryAddress(quotation.customer),
          customerId: quotation.customerId,
          quotationId: quotation.id,
          items: {
            create: quotation.items.map((item, n) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice!.toString(),
              hsnCode: item.hsnCode,
              gstRatePercent: item.gstRatePercent!.toString(),
              lineTotal: math.lines[n]!.lineTotal!,
              productId: item.productId,
            })),
          },
        },
        select: { id: true },
      });
      return { ok: true, id: order.id };
    });
    if (result.ok) {
      refresh();
      revalidatePath(`/admin/quotes/${quotationId}`);
    }
    return result;
  } catch (error) {
    // Two people clicking at the same moment: the second insert hits the one-order-per-quotation rule. Return the winner's order.
    if (JSON.stringify((error as { meta?: unknown } | null)?.meta ?? "").includes("quotationId") || (error as { code?: string } | null)?.code === "P2002") {
      const winner = await getDb().order.findUnique({ where: { quotationId }, select: { id: true } }).catch(() => null);
      if (winner) return { ok: true, id: winner.id };
    }
    return fail(error, "createOrderFromQuotation");
  }
}

// ───────────────────────────── editing ─────────────────────────────

const EDITABLE: readonly string[] = ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING"];

const ADDRESS_FIELDS = ["shippingLine1", "shippingCity", "shippingState", "shippingPincode"] as const;
const INVOICED: readonly string[] = ["ISSUED", "PARTIALLY_PAID", "PAID"];

/**
 * Delivery address and internal notes. Open until the goods leave. Once an invoice has been issued the address is locked (the
 * invoice's place of supply and printed "ship to" rest on it); notes stay editable, but the system's own log lines in them do not.
 */
export async function updateOrderDetails(id: string, raw: Record<string, string>): Promise<OResult> {
  await requireAdmin();
  const parsed = orderDetailsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<OResult> => {
      await lockOrder(tx, id);
      const order = await tx.order.findUnique({ where: { id }, select: { status: true, notes: true, shippingLine1: true, shippingCity: true, shippingState: true, shippingPincode: true } });
      if (!order) return { ok: false, message: "That order no longer exists." };
      if (!EDITABLE.includes(order.status)) return { ok: false, message: "This order can no longer be edited." };
      const { notes, ...address } = parsed.data;
      if (ADDRESS_FIELDS.some((field) => address[field] !== order[field])) {
        const invoiced = await tx.invoice.count({ where: { orderId: id, status: { in: INVOICED as never[] } } });
        if (invoiced > 0) return { ok: false, message: "An invoice has been issued for this order, so its delivery address is locked. Void the invoice first if the address was wrong." };
      }
      await tx.order.update({ where: { id }, data: { ...address, notes: joinNotes(cleanUserNotes(notes), splitNotes(order.notes).log) } });
      return { ok: true, id };
    });
    if (result.ok) refresh(id);
    return result;
  } catch (error) {
    return fail(error, "updateOrderDetails");
  }
}

// ───────────────────────────── status ─────────────────────────────

const OWNER_ONLY: readonly OrderAction[] = ["CONFIRM", "CANCEL"];
const FLOW: Record<OrderAction, { from: readonly string[]; to: (typeof ORDER_STATUSES)[number] }> = {
  CONFIRM: { from: ["PENDING_CONFIRMATION"], to: "CONFIRMED" },
  PROCESS: { from: ["CONFIRMED"], to: "PROCESSING" },
  DISPATCH: { from: ["PROCESSING"], to: "DISPATCHED" },
  DELIVER: { from: ["DISPATCHED"], to: "DELIVERED" },
  CANCEL: { from: ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING"], to: "CANCELLED" },
};

const STEP_LOG: Record<OrderAction, string> = {
  CONFIRM: "order confirmed",
  PROCESS: "processing started",
  DISPATCH: "marked as dispatched",
  DELIVER: "marked as delivered",
  CANCEL: "order cancelled",
};

/**
 * Moves an order along. Confirming and cancelling are the OWNER's decisions; staff may process, dispatch and mark delivered.
 * `raw` carries the transport details for DISPATCH.
 */
export async function setOrderStatus(id: string, action: string, raw: Record<string, string> = {}): Promise<OResult> {
  const session = await requireAdmin();
  if (!(ORDER_ACTIONS as readonly string[]).includes(action)) return { ok: false, message: "Unknown action." };
  const step = action as OrderAction;
  if (OWNER_ONLY.includes(step) && session.role !== "OWNER") return { ok: false, message: "Only the owner can confirm or cancel an order." };

  let transport: { transporter: string | null; trackingReference: string | null } | null = null;
  if (step === "DISPATCH") {
    const parsed = dispatchSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    transport = parsed.data;
  }

  try {
    const db = getDb();
    const result = await db.$transaction(async (tx: Tx): Promise<OResult> => {
      // Locked first, so "cancel" and "issue an invoice" can not both succeed on the same order at the same moment.
      await lockOrder(tx, id);
      const order = await tx.order.findUnique({ where: { id }, select: { status: true, invoices: { select: { status: true } } } });
      if (!order) return { ok: false, message: "That order no longer exists." };
      const rule = FLOW[step];
      if (!rule.from.includes(order.status)) return { ok: false, message: `A ${order.status.toLowerCase().replaceAll("_", " ")} order can not do that.` };
      if (step === "CANCEL" && order.invoices.some((i) => INVOICED.includes(i.status))) {
        return { ok: false, message: "This order has an issued invoice. Void the invoice first, then cancel the order." };
      }
      const now = new Date();
      const data: Prisma.OrderUpdateManyMutationInput = { status: rule.to };
      if (step === "CONFIRM") data.confirmedAt = now;
      if (step === "DISPATCH") Object.assign(data, { dispatchedAt: now, transporter: transport!.transporter, trackingReference: transport!.trackingReference });
      if (step === "DELIVER") data.deliveredAt = now;
      // Compare-and-set: if someone else moved the order in the meantime, change nothing.
      const changed = await tx.order.updateMany({ where: { id, status: { in: rule.from as never[] } }, data });
      if (changed.count !== 1) return { ok: false, message: "The order was just changed by someone else. Reload and try again." };
      await appendOrderLog(tx, id, logLine(istDay(now), session.name, STEP_LOG[step]));
      return { ok: true, id };
    });
    if (result.ok) refresh(id);
    return result;
  } catch (error) {
    return fail(error, "setOrderStatus");
  }
}
