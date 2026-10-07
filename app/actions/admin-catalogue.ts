"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveBrand, saveCategory, createProduct, setProductStatus, updateProduct, updateStock } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { formToObject, type AdminFormState } from "@/lib/validation/admin-catalogue";

/**
 * Thin server-action wrappers for the admin forms. Each one calls requireAdmin() itself (the data functions do too):
 * a server action is a public POST endpoint, so it must never rely on the page that rendered the form.
 */

function toState(result: Awaited<ReturnType<typeof createProduct>>, raw: Record<string, string>): AdminFormState {
  return result.ok ? { ok: true } : { message: result.message, fieldErrors: result.fieldErrors, values: raw };
}

export async function saveProductAction(id: string | null, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = id ? await updateProduct(id, raw) : await createProduct(raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath("/admin", "layout");
  redirect("/admin/products?saved=1");
}

export async function saveBrandAction(id: string | null, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await saveBrand(id, raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath("/admin", "layout");
  redirect("/admin/brands?saved=1");
}

export async function saveCategoryAction(id: string | null, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await saveCategory(id, raw);
  if (!result.ok) return toState(result, raw);
  revalidatePath("/admin", "layout");
  redirect("/admin/categories?saved=1");
}

export async function setProductStatusAction(id: string, status: "DRAFT" | "ACTIVE" | "INACTIVE", data: FormData): Promise<void> {
  void data;
  await requireAdmin();
  const result = await setProductStatus(id, status);
  revalidatePath("/admin", "layout");
  redirect(result.ok ? "/admin/products?saved=1" : "/admin/products?failed=1");
}

export async function updateStockAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const result = await updateStock(id, raw);
  if (!result.ok) return { message: result.message, values: raw };
  return { ok: true, message: "Saved", values: raw };
}
