"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveCustomer } from "@/lib/admin/customer-admin";
import {
  addQuotationLine,
  createQuotationForCustomer,
  createQuotationFromEnquiry,
  removeQuotationLine,
  setQuotationStatus,
  updateQuotationHeader,
  updateQuotationLine,
} from "@/lib/admin/quotation-admin";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { formToObject, type AdminFormState } from "@/lib/validation/admin-catalogue";

/** Server-action wrappers for customers and quotations. Each calls requireAdmin() / requireOwner() itself. */

type R = { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };
const toState = (r: R, raw: Record<string, string>, okMessage = "Saved"): AdminFormState =>
  r.ok ? { ok: true, message: okMessage, values: raw } : { message: r.message, fieldErrors: r.fieldErrors, values: raw };

export async function saveCustomerAction(id: string | null, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await saveCustomer(id, raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath("/admin/customers");
  redirect("/admin/customers?saved=1");
}

export async function createQuoteFromEnquiryAction(enquiryId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireAdmin();
  const result = await createQuotationFromEnquiry(enquiryId);
  if (!result.ok) return { message: result.message };
  redirect(`/admin/quotes/${result.id}`);
}

export async function createQuoteForCustomerAction(_prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await createQuotationForCustomer(raw.customerId ?? "");
  if (!result.ok) return toState(result, raw);
  redirect(`/admin/quotes/${result.id}`);
}

export async function saveQuoteHeaderAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  return toState(await updateQuotationHeader(id, raw), raw);
}

export async function addQuoteLineAction(quotationId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await addQuotationLine(quotationId, raw);
  return result.ok ? { ok: true, message: "Line added" } : toState(result, raw);
}

export async function updateQuoteLineAction(lineId: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  return toState(await updateQuotationLine(lineId, raw), raw);
}

export async function removeQuoteLineAction(lineId: string, data: FormData): Promise<void> {
  void data;
  await requireAdmin();
  await removeQuotationLine(lineId);
}

/** OWNER only. Returns a message instead of redirecting so a refusal ("every line needs a price") is shown in place. */
export async function quoteStatusAction(id: string, action: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireOwner();
  const result = await setQuotationStatus(id, action);
  if (!result.ok) return { message: result.message };
  revalidatePath(`/admin/quotes/${id}`);
  redirect(`/admin/quotes/${id}?done=${encodeURIComponent(action)}`);
}
