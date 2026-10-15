"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { changeOwnPassword, createStaffUser, setUserActive, setUserPassword, signOutOtherDevices, unlockUser } from "@/lib/admin/user-admin";
import { setupTokenMatches } from "@/lib/auth/authenticate";
import { requireAdmin, requireOwner } from "@/lib/auth/guard";
import { recoveryEnabled, resetPasswordWithKey } from "@/lib/auth/recovery";
import { sessionCookieName } from "@/lib/auth/session";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { fieldErrors, formToObject, type AdminFormState } from "@/lib/validation/admin-catalogue";
import { recoverySchema } from "@/lib/validation/admin-sales";

/** Server-action wrappers for user management. Each calls requireOwner() / requireAdmin() itself. */

type R = { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };
/** Passwords are never sent back to the browser, not even on an error. */
const SECRET_FIELDS = ["password", "confirm", "current", "key"];
const safeValues = (raw: Record<string, string>) => Object.fromEntries(Object.entries(raw).filter(([k]) => !SECRET_FIELDS.includes(k)));
const toState = (r: R, raw: Record<string, string>, okMessage: string): AdminFormState =>
  r.ok ? { ok: true, message: okMessage } : { message: r.message, fieldErrors: r.fieldErrors, values: safeValues(raw) };

export async function createStaffAction(_prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireOwner();
  const raw = formToObject(data);
  const result = await createStaffUser(raw);
  if (!result.ok) return toState(result, raw, "");
  redirect("/admin/users?created=1");
}

export async function setUserPasswordAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireOwner();
  const raw = formToObject(data);
  return toState(await setUserPassword(id, raw), raw, "New password saved. They have been signed out everywhere — tell them the new password in person.");
}

export async function setUserActiveAction(id: string, active: boolean, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireOwner();
  const result = await setUserActive(id, active);
  if (!result.ok) return { message: result.message };
  // Redirect so the page shows the confirmation after its buttons have changed (the button that was clicked is gone by then).
  redirect(`/admin/users/${encodeURIComponent(id)}?done=${active ? "reactivated" : "deactivated"}`);
}

export async function unlockUserAction(id: string, _prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireOwner();
  const result = await unlockUser(id);
  if (!result.ok) return { message: result.message };
  redirect(`/admin/users/${encodeURIComponent(id)}?done=unlocked`);
}

export async function changeOwnPasswordAction(_prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = formToObject(data);
  const token = (await cookies()).get(sessionCookieName())?.value;
  return toState(await changeOwnPassword(raw, token), raw, "Password changed. Every other device has been signed out.");
}

export async function signOutOtherDevicesAction(_prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  void data;
  await requireAdmin();
  const token = (await cookies()).get(sessionCookieName())?.value;
  const result = await signOutOtherDevices(token);
  return result.ok ? { ok: true, message: "Signed out on every other device." } : { message: result.message };
}

/** Public page: recover an account with the setup key from Vercel. Off unless ADMIN_SETUP_TOKEN is set and long enough. */
export async function recoveryAction(_prev: AdminFormState, data: FormData): Promise<AdminFormState> {
  if (!isDatabaseConfigured()) notFound();
  const expected = getServerEnv().ADMIN_SETUP_TOKEN;
  if (!recoveryEnabled(expected)) notFound();
  const raw = formToObject(data);
  const values = safeValues(raw);
  const parsed = recoverySchema.safeParse(raw);
  if (!parsed.success) return { message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  if (!setupTokenMatches(parsed.data.key, expected)) return { message: "Please check the highlighted fields.", fieldErrors: { key: "That setup key is not correct" }, values };
  const result = await resetPasswordWithKey(getDb(), { email: parsed.data.email, newPassword: parsed.data.password });
  if (!result.ok) {
    if (result.reason === "weak-password") return { message: result.message ?? "Choose a stronger password.", fieldErrors: { password: result.message ?? "Choose a stronger password" }, values };
    return { message: "No active account has that e-mail.", fieldErrors: { email: "No active account has that e-mail" }, values };
  }
  redirect("/admin/login?reset=1");
}
