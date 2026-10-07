"use client";

import { useActionState } from "react";
import { loginAction, setupAction } from "@/app/actions/admin-auth";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { AuthFormState } from "@/lib/validation/admin-auth";

const initial: AuthFormState = {};

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800">
      {message}
    </p>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} aria-busy={pending} className="grid gap-5">
      <ErrorBanner message={state.error} />
      <TextField id="email" label="E-mail" required type="email" autoComplete="username" defaultValue={state.values?.email} maxLength={254} />
      <TextField id="password" label="Password" required type="password" autoComplete="current-password" maxLength={128} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, initial);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} aria-busy={pending} className="grid gap-5">
      <ErrorBanner message={state.error} />
      <TextField id="token" label="Setup key" required type="password" autoComplete="off" hint="The one-time setup key you added in Vercel." error={errors.token} maxLength={300} />
      <TextField id="name" label="Your name" required autoComplete="name" defaultValue={state.values?.name} error={errors.name} maxLength={100} />
      <TextField id="email" label="E-mail" required type="email" autoComplete="username" defaultValue={state.values?.email} error={errors.email} maxLength={254} />
      <TextField id="password" label="Password" required type="password" autoComplete="new-password" hint="At least 12 characters." error={errors.password} maxLength={128} />
      <TextField id="confirm" label="Repeat password" required type="password" autoComplete="new-password" error={errors.confirm} maxLength={128} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create owner account"}
      </Button>
    </form>
  );
}
