import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { computeQuote, financialYearOf, quotationNumber } from "@/lib/domain/quote-math";
import { fieldErrors } from "@/lib/validation/admin-catalogue";
import { lineSchema, quotationHeaderSchema, QUOTE_STATUS_ACTIONS, type QuoteStatusAction } from "@/lib/validation/admin-sales";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Admin data functions for quotations. Every exported function calls requireAdmin() / requireOwner() first.
 *
 * Rules (see docs/ADMIN.md):
 *  • Prices, GST rates and HSN on a quotation line are set by the OWNER only (recorded as ADMIN). Staff can create a
 *    draft and edit descriptions, quantities and units.
 *  • Marking a quotation SENT / ACCEPTED / REJECTED / EXPIRED / CANCELLED is the OWNER's decision. "Sent" records that the
 *    owner shared it — this system sends nothing to the customer by itself.
 *  • A quotation can only leave DRAFT when every line has a price and a GST rate; its totals are computed exactly
 *    (lib/domain/quote-math.ts) and NULL until then.
 *  • Lines of a SENT or ACCEPTED quotation are frozen (also enforced by a database trigger).
 *  • Quotations are never deleted — cancel them.
 */

export type QResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };
type Tx = Prisma.TransactionClient;

const PAGE_SIZE = 25;
const GENERIC: QResult = { ok: false, message: "Could not save. Please try again." };
const fail = (error: unknown, what: string): QResult => {
  console.error(`[admin] ${what} failed:`, error instanceof Error ? error.message : "unknown");
  return GENERIC;
};
const refresh = (id?: string) => {
  revalidatePath("/admin/quotes");
  if (id) revalidatePath(`/admin/quotes/${id}`);
};

// ───────────────────────────── numbering ─────────────────────────────

/** Gap-free number: the counter row is incremented inside the same transaction as the quotation. */
async function nextQuotationNumber(tx: Tx, now = new Date()): Promise<string> {
  const financialYear = financialYearOf(now);
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await tx.numberSequence.upsert({
        where: { scope_financialYear: { scope: "QT", financialYear } },
        create: { scope: "QT", financialYear, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
        select: { lastValue: true },
      });
      return quotationNumber(financialYear, row.lastValue);
    } catch (error) {
      // Two first-of-the-year requests can race on the insert: the loser simply retries as an update.
      if ((error as { code?: string } | null)?.code === "P2002" && attempt < 3) continue;
      throw error;
    }
  }
}

// ───────────────────────────── totals ─────────────────────────────

/** Recomputes each line total and the quotation totals from the lines as stored. Call inside the same transaction as the change. */
async function recompute(tx: Tx, quotationId: string): Promise<{ overflow: boolean }> {
  const items = await tx.quotationItem.findMany({ where: { quotationId }, orderBy: { id: "asc" } });
  const result = computeQuote(items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice?.toString() ?? null, gstRatePercent: i.gstRatePercent?.toString() ?? null })));
  for (const [index, item] of items.entries()) {
    const lineTotal = result.overflow ? null : result.lines[index]!.lineTotal;
    const current = item.lineTotal?.toString() ?? null;
    if (current === null ? lineTotal !== null : lineTotal === null || Number(current) !== Number(lineTotal)) {
      await tx.quotationItem.update({ where: { id: item.id }, data: { lineTotal } });
    }
  }
  await tx.quotation.update({ where: { id: quotationId }, data: { subtotal: result.subtotal, taxTotal: result.taxTotal, total: result.total } });
  return { overflow: result.overflow };
}

// ───────────────────────────── reading ─────────────────────────────

export async function listQuotations(params: { status?: string; page?: number }) {
  await requireAdmin();
  const where: Prisma.QuotationWhereInput = {};
  if (["DRAFT", "PENDING_APPROVAL", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"].includes(params.status ?? "")) where.status = params.status as never;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const db = getDb();
  const [total, items] = await Promise.all([
    db.quotation.count({ where }),
    db.quotation.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { customer: { select: { organizationName: true } }, _count: { select: { items: true } } } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getQuotation(id: string) {
  await requireAdmin();
  const quotation = await getDb().quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      enquiry: { include: { items: true } },
      items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true } } } },
    },
  });
  if (!quotation) return null;
  const math = computeQuote(quotation.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice?.toString() ?? null, gstRatePercent: i.gstRatePercent?.toString() ?? null })));
  return { ...quotation, lineMath: math.lines, complete: math.total !== null };
}

export async function listProductOptions() {
  await requireAdmin();
  return getDb().product.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 1000 });
}

// ───────────────────────────── creating ─────────────────────────────

/** Turns an enquiry into a DRAFT quotation. Idempotent: a second click returns the draft that already exists. */
export async function createQuotationFromEnquiry(enquiryId: string): Promise<QResult> {
  await requireAdmin();
  try {
    const db = getDb();
    const enquiry = await db.enquiry.findUnique({ where: { id: enquiryId }, include: { lead: true, items: true, quotations: { where: { status: "DRAFT" }, select: { id: true }, take: 1 } } });
    if (!enquiry) return { ok: false, message: "That enquiry no longer exists." };
    if (enquiry.quotations[0]) return { ok: true, id: enquiry.quotations[0].id };

    const productIds = enquiry.items.map((i) => i.productId).filter((v): v is string => Boolean(v));
    const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, unit: true, hsnCode: true, gstRatePercent: true } }) : [];
    const byId = new Map(products.map((p) => [p.id, p]));

    const id = await db.$transaction(async (tx) => {
      const lead = enquiry.lead;
      let customerId = lead.customerId;
      if (!customerId) {
        const customer = await tx.customer.create({
          data: { organizationName: lead.organizationName ?? lead.name, contactName: lead.name, phone: lead.phone, email: lead.email, billingCity: lead.city, billingState: lead.state },
        });
        customerId = customer.id;
      }
      await tx.lead.update({ where: { id: lead.id }, data: { customerId, ...(lead.status === "NEW" || lead.status === "CONTACTED" ? { status: "QUALIFIED" as const } : {}) } });
      if (enquiry.status === "NEW") await tx.enquiry.update({ where: { id: enquiry.id }, data: { status: "IN_REVIEW" } });

      const quotation = await tx.quotation.create({ data: { number: await nextQuotationNumber(tx), createdBy: "ADMIN", customerId, enquiryId: enquiry.id } });
      for (const item of enquiry.items) {
        const product = item.productId ? byId.get(item.productId) : undefined;
        // The customer's quantity is free text ("2 boxes"). Take a leading number if there is one, else 1 — the page
        // shows what the customer wrote next to the line so the owner can correct it.
        const quantity = Number(/^\s*(\d{1,8})\b/.exec(item.quantityNote ?? "")?.[1] ?? 1) || 1;
        await tx.quotationItem.create({
          data: {
            quotationId: quotation.id,
            productId: item.productId,
            description: item.productName,
            quantity,
            unit: product?.unit ?? "pcs",
            hsnCode: product?.hsnCode ?? null,
            gstRatePercent: product?.gstRatePercent ?? null,
          },
        });
      }
      await recompute(tx, quotation.id);
      return quotation.id;
    });
    refresh();
    revalidatePath("/admin/enquiries");
    return { ok: true, id };
  } catch (error) {
    return fail(error, "createQuotationFromEnquiry");
  }
}

export async function createQuotationForCustomer(customerId: string): Promise<QResult> {
  await requireAdmin();
  try {
    const db = getDb();
    if (!(await db.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) return { ok: false, message: "Choose a customer." , fieldErrors: { customerId: "Choose a customer" } };
    const id = await db.$transaction(async (tx) => (await tx.quotation.create({ data: { number: await nextQuotationNumber(tx), createdBy: "ADMIN", customerId } })).id);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return fail(error, "createQuotationForCustomer");
  }
}

// ───────────────────────────── editing (DRAFT only) ─────────────────────────────

async function requireDraft(db: PrismaClient | Tx, quotationId: string): Promise<QResult | null> {
  const q = await db.quotation.findUnique({ where: { id: quotationId }, select: { status: true } });
  if (!q) return { ok: false, message: "That quotation no longer exists." };
  if (q.status !== "DRAFT") return { ok: false, message: "Only a draft quotation can be edited." };
  return null;
}

export async function updateQuotationHeader(id: string, raw: Record<string, string>): Promise<QResult> {
  await requireAdmin();
  const parsed = quotationHeaderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const bad = await requireDraft(db, id);
    if (bad) return bad;
    const { validUntil, terms, notes } = parsed.data;
    await db.quotation.update({ where: { id }, data: { validUntil: validUntil ? new Date(`${validUntil}T23:59:59+05:30`) : null, terms, notes } });
    refresh(id);
    return { ok: true, id };
  } catch (error) {
    return fail(error, "updateQuotationHeader");
  }
}

const PRICE_KEYS = ["unitPrice", "gstRatePercent", "hsnCode"] as const;

/** Adds a line. Choosing a product fills blank description / unit / HSN / GST (and, for the owner, the product's wholesale price). */
export async function addQuotationLine(quotationId: string, raw: Record<string, string>): Promise<QResult> {
  const session = await requireAdmin();
  const parsed = lineSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const owner = session.role === "OWNER";
  if (!owner && PRICE_KEYS.some((k) => input[k] !== null)) return { ok: false, message: "Only the owner can enter prices, GST and HSN.", fieldErrors: {} };
  try {
    const db = getDb();
    const bad = await requireDraft(db, quotationId);
    if (bad) return bad;
    const product = input.productId ? await db.product.findUnique({ where: { id: input.productId } }) : null;
    if (input.productId && !product) return { ok: false, message: "That product no longer exists.", fieldErrors: { productId: "Choose a product from the list" } };
    const description = input.description ?? product?.name;
    if (!description) return { ok: false, message: "Describe the item or choose a product.", fieldErrors: { description: "Describe the item or choose a product" } };
    const unitPrice = input.unitPrice ?? (owner && product?.wholesalePrice ? product.wholesalePrice.toString() : null);
    await db.$transaction(async (tx) => {
      await tx.quotationItem.create({
        data: {
          quotationId,
          productId: product?.id ?? null,
          description,
          quantity: input.quantity,
          unit: input.unit,
          unitPrice,
          priceSetBy: unitPrice !== null ? "ADMIN" : null,
          hsnCode: input.hsnCode ?? (owner ? (product?.hsnCode ?? null) : null),
          gstRatePercent: input.gstRatePercent ?? (owner ? (product?.gstRatePercent?.toString() ?? null) : null),
        },
      });
      await recompute(tx, quotationId);
    });
    refresh(quotationId);
    return { ok: true, id: quotationId };
  } catch (error) {
    return fail(error, "addQuotationLine");
  }
}

export async function updateQuotationLine(lineId: string, raw: Record<string, string>): Promise<QResult> {
  const session = await requireAdmin();
  const parsed = lineSchema.safeParse({ ...raw, description: raw.description });
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (!input.description) return { ok: false, message: "Describe the item.", fieldErrors: { description: "Describe the item" } };
  try {
    const db = getDb();
    const line = await db.quotationItem.findUnique({ where: { id: lineId } });
    if (!line) return { ok: false, message: "That line no longer exists." };
    const bad = await requireDraft(db, line.quotationId);
    if (bad) return bad;
    if (session.role !== "OWNER") {
      const same = (a: string | null, b: string | null) => (a === null || b === null ? a === b : Number(a) === Number(b));
      // A staff form does not send the price boxes (they are disabled): keep what is stored.
      const sent = (k: (typeof PRICE_KEYS)[number]) => k in raw;
      const changed =
        (sent("unitPrice") && !same(input.unitPrice, line.unitPrice?.toString() ?? null)) ||
        (sent("gstRatePercent") && !same(input.gstRatePercent, line.gstRatePercent?.toString() ?? null)) ||
        (sent("hsnCode") && input.hsnCode !== line.hsnCode);
      if (changed) return { ok: false, message: "Only the owner can change prices, GST and HSN.", fieldErrors: {} };
      if (!sent("unitPrice")) input.unitPrice = line.unitPrice?.toString() ?? null;
      if (!sent("gstRatePercent")) input.gstRatePercent = line.gstRatePercent?.toString() ?? null;
      if (!sent("hsnCode")) input.hsnCode = line.hsnCode;
    }
    await db.$transaction(async (tx) => {
      await tx.quotationItem.update({
        where: { id: lineId },
        data: {
          description: input.description!,
          quantity: input.quantity,
          unit: input.unit,
          unitPrice: input.unitPrice,
          priceSetBy: input.unitPrice !== null ? ("ADMIN" as const) : null,
          hsnCode: input.hsnCode,
          gstRatePercent: input.gstRatePercent,
        },
      });
      await recompute(tx, line.quotationId);
    });
    refresh(line.quotationId);
    return { ok: true, id: line.quotationId };
  } catch (error) {
    return fail(error, "updateQuotationLine");
  }
}

export async function removeQuotationLine(lineId: string): Promise<QResult> {
  await requireAdmin();
  try {
    const db = getDb();
    const line = await db.quotationItem.findUnique({ where: { id: lineId }, select: { quotationId: true } });
    if (!line) return { ok: false, message: "That line no longer exists." };
    const bad = await requireDraft(db, line.quotationId);
    if (bad) return bad;
    await db.$transaction(async (tx) => {
      await tx.quotationItem.delete({ where: { id: lineId } });
      await recompute(tx, line.quotationId);
    });
    refresh(line.quotationId);
    return { ok: true, id: line.quotationId };
  } catch (error) {
    return fail(error, "removeQuotationLine");
  }
}

// ───────────────────────────── status (OWNER only) ─────────────────────────────

const TRANSITIONS: Record<string, readonly QuoteStatusAction[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
};

/** The owner's decision. SENT records that the owner shared the quotation with the customer; this system sends nothing itself. */
export async function setQuotationStatus(id: string, action: string): Promise<QResult> {
  await requireOwner();
  if (!(QUOTE_STATUS_ACTIONS as readonly string[]).includes(action)) return { ok: false, message: "Unknown action." };
  const target = action as QuoteStatusAction;
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx): Promise<QResult> => {
      const q = await tx.quotation.findUnique({ where: { id }, include: { enquiry: { select: { id: true, status: true } }, customer: { select: { id: true } } } });
      if (!q) return { ok: false, message: "That quotation no longer exists." };
      if (!(TRANSITIONS[q.status] ?? []).includes(target)) return { ok: false, message: `A ${q.status.toLowerCase().replace("_", " ")} quotation cannot be marked ${target.toLowerCase()}.` };
      if (target === "SENT") {
        const { overflow } = await recompute(tx, id);
        const fresh = await tx.quotation.findUniqueOrThrow({ where: { id }, select: { total: true } });
        if (overflow) return { ok: false, message: "An amount is too large. Check the quantities and prices." };
        if (fresh.total === null) return { ok: false, message: "Every line needs a price and a GST rate before the quotation can be marked as sent." };
      }
      await tx.quotation.update({ where: { id }, data: { status: target, ...(target === "SENT" ? { sentAt: new Date() } : {}) } });
      if (target === "SENT" && q.enquiry && ["NEW", "IN_REVIEW"].includes(q.enquiry.status)) await tx.enquiry.update({ where: { id: q.enquiry.id }, data: { status: "QUOTED" } });
      if (target === "ACCEPTED" && q.enquiry) await tx.enquiry.update({ where: { id: q.enquiry.id }, data: { status: "WON" } });
      if (target === "REJECTED" && q.enquiry) await tx.enquiry.update({ where: { id: q.enquiry.id }, data: { status: "LOST" } });
      return { ok: true, id };
    });
    if (result.ok) refresh(id);
    return result;
  } catch (error) {
    return fail(error, "setQuotationStatus");
  }
}
