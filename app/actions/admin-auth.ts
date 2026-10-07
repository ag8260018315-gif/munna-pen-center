"use server";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { attemptLogin, createFirstOwner, setupTokenMatches } from "@/lib/auth/authenticate";
import { deleteSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { loginSchema, setupSchema, type AuthFormState } from "@/lib/validation/admin-auth";

const LOGIN_FAILED = "That e-mail and password do not match, or the account is temporarily locked. Try again in a few minutes.";

const text = (data: FormData, key: string) => (typeof data.get(key) === "string" ? (data.get(key) as string) : "");

function requireDatabase() {
  if (!isDatabaseConfigured()) notFound();
}

export async function loginAction(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  requireDatabase();
  const parsed = loginSchema.safeParse({ email: text(data, "email"), password: text(data, "password") });
  if (!parsed.success) return { error: "Enter your e-mail and password.", values: { email: text(data, "email") } };

  const userAgent = (await headers()).get("user-agent");
  let result;
  try {
    result = await attemptLogin(getDb(), parsed.data.email, parsed.data.password, userAgent);
  } catch (error) {
    console.error("[admin-login] failed:", error instanceof Error ? error.message : "unknown");
    return { error: "Sign-in is not available right now. Please try again shortly.", values: { email: parsed.data.email } };
  }
  if (!result.ok) return { error: LOGIN_FAILED, values: { email: parsed.data.email } };

  (await cookies()).set(sessionCookieName(), result.token, sessionCookieOptions(result.expiresAt));
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  if (isDatabaseConfigured()) await deleteSession(getDb(), jar.get(sessionCookieName())?.value);
  jar.delete(sessionCookieName());
  redirect("/admin/login");
}

export async function setupAction(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  requireDatabase();
  const expected = getServerEnv().ADMIN_SETUP_TOKEN;
  if (!expected) notFound(); // setup is off unless the owner switched it on in Vercel
  const values = { name: text(data, "name"), email: text(data, "email") };

  const parsed = setupSchema.safeParse({
    token: text(data, "token"),
    name: text(data, "name"),
    email: text(data, "email"),
    password: text(data, "password"),
    confirm: text(data, "confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors, values };
  }
  if (!setupTokenMatches(parsed.data.token, expected)) return { fieldErrors: { token: "That setup key is not correct" }, error: "Please check the highlighted fields.", values };

  const result = await createFirstOwner(getDb(), { email: parsed.data.email, name: parsed.data.name, password: parsed.data.password });
  if (!result.ok) {
    if (result.reason === "already-set-up") return { error: "An admin account already exists. Sign in instead.", values };
    if (result.reason === "weak-password") return { fieldErrors: { password: result.message ?? "Choose a stronger password" }, error: "Please check the highlighted fields.", values };
    return { error: "Please check the details and try again.", values };
  }
  redirect("/admin/login?created=1");
}
