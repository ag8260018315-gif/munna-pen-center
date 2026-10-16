"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { issueInvoice, createInvoiceDraft, recordPayment, reversePayment, setInvoiceLineHsn, updateInvoiceDraft, voidInvoice } from "@/lib/admin/invoice-admin";
import { createOrderFromQuotation, setOrderStatus, updateOrderDetails } from "@/lib/admin/order-admin";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { formToObject, type AdminFormState } from "@/lib/validation/admin-catalogue";

/** Server-action wrappers for orders, invoices and payments. Each calls requireAdmin() / requireOwner() itself. */

type R = { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };
const toState = (r: R, raw: Record<string, string>, okMessage = "Saved"): AdminFormState =>
  r.ok ? { ok: true, message: okMessage, values: raw } : { message: r.message, fieldErrors: r.fieldErrors, values: raw };

// ───────────────────────────── orders ─────────────────────────────

export async function createOrderAction(quotationId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireAdmin();
  const result = await createOrderFromQuotation(quotationId);
  if (!result.ok) return { message: result.message };
  redirect(`/admin/orders/${result.id}`);
}

const OWNER_ORDER_STEPS = ["CONFIRM", "CANCEL"];

/** Confirm / process / deliver / cancel. Confirming and cancelling are the owner's. Returns a message so a refusal is shown in place. */
export async function orderStepAction(id: string, step: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  if (OWNER_ORDER_STEPS.includes(step)) await requireOwner();
  else await requireAdmin();
  const result = await setOrderStatus(id, step);
  if (!result.ok) return { message: result.message };
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?done=${encodeURIComponent(step)}`);
}

export async function dispatchOrderAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await setOrderStatus(id, "DISPATCH", raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?done=DISPATCH`);
}

export async function saveOrderDetailsAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  return toState(await updateOrderDetails(id, raw), raw);
}

// ───────────────────────────── invoices ─────────────────────────────

export async function createInvoiceDraftAction(orderId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireAdmin();
  const result = await createInvoiceDraft(orderId);
  if (!result.ok) return { message: result.message };
  redirect(`/admin/invoices/${result.id}`);
}

export async function saveInvoiceDraftAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  return toState(await updateInvoiceDraft(id, raw), raw);
}

export async function saveInvoiceLineHsnAction(lineId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  return toState(await setInvoiceLineHsn(lineId, raw), raw, "HSN saved");
}

/** OWNER only. The form carries a "I have checked it" box; without it nothing is issued. */
export async function issueInvoiceAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireOwner();
  const raw = formToObject(data);
  if (raw.checked !== "on") return { message: "Tick the box to confirm you have checked the invoice, then issue it.", fieldErrors: { checked: "Tick the box to continue" } };
  const result = await issueInvoice(id, raw.reviewKey ?? "");
  if (!result.ok) return { message: result.message };
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}?done=issued`);
}

/** OWNER only. */
export async function voidInvoiceAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireOwner();
  const raw = formToObject(data);
  const result = await voidInvoice(id, raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}?done=void`);
}

// ───────────────────────────── payments ─────────────────────────────

export async function recordPaymentAction(invoiceId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await recordPayment(invoiceId, raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(`/admin/invoices/${invoiceId}?done=payment`);
}

/** OWNER only. */
export async function reversePaymentAction(paymentId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireOwner();
  const raw = formToObject(data);
  const result = await reversePayment(paymentId, raw);
  if (!result.ok) return toState(result, raw);
  // The invoice id comes back from the server, not from the browser.
  revalidatePath(`/admin/invoices/${result.id}`);
  redirect(`/admin/invoices/${result.id}?done=reversed`);
}
