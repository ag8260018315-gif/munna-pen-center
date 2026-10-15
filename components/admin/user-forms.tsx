"use client";

import { useActionState } from "react";
import { FormShell } from "@/components/admin/catalogue-forms";
import { Notice } from "@/components/admin/ui";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/validation/admin-catalogue";

type Action = (prev: AdminFormState, data: FormData) => Promise<AdminFormState>;

const passwordHint = "At least 12 characters. Use something you do not use anywhere else.";

export function NewStaffForm({ action }: { action: Action }) {
  return (
    <FormShell action={action} submitLabel="Create staff account">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="name" label="Name" required autoComplete="off" defaultValue={s.values?.name} error={e.name} maxLength={100} />
            <TextField id="email" label="E-mail" required type="email" autoComplete="off" defaultValue={s.values?.email} error={e.email} maxLength={254} hint="They sign in with this." />
            <TextField id="password" label="Starting password" required type="password" autoComplete="new-password" error={e.password} maxLength={128} hint={passwordHint} />
            <TextField id="confirm" label="Repeat password" required type="password" autoComplete="new-password" error={e.confirm} maxLength={128} />
            <p className="text-sm text-muted sm:col-span-2">Tell them the password in person, and ask them to change it under “My account” the first time they sign in. Staff can add and edit products, brands, categories, stock, customers and draft quotations; only you can enter prices, GST and HSN or send and close quotations.</p>
          </div>
        );
      }}
    </FormShell>
  );
}

export function SetPasswordForm({ action }: { action: Action }) {
  return (
    <FormShell action={action} submitLabel="Set new password">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="password" label="New password" required type="password" autoComplete="new-password" error={e.password} maxLength={128} hint={passwordHint} />
            <TextField id="confirm" label="Repeat new password" required type="password" autoComplete="new-password" error={e.confirm} maxLength={128} />
          </div>
        );
      }}
    </FormShell>
  );
}

export function ChangeOwnPasswordForm({ action }: { action: Action }) {
  return (
    <FormShell action={action} submitLabel="Change my password">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 sm:max-w-md">
            <TextField id="current" label="Current password" required type="password" autoComplete="current-password" error={e.current} maxLength={128} />
            <TextField id="password" label="New password" required type="password" autoComplete="new-password" error={e.password} maxLength={128} hint={passwordHint} />
            <TextField id="confirm" label="Repeat new password" required type="password" autoComplete="new-password" error={e.confirm} maxLength={128} />
          </div>
        );
      }}
    </FormShell>
  );
}

/** A single button with its own result message (used for deactivate / reactivate / unlock / sign out elsewhere). */
export function ActionButton({ action, label, variant = "secondary", confirm }: { action: Action; label: string; variant?: "primary" | "secondary"; confirm?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className="grid gap-2"
    >
      <div>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? "Please wait…" : label}
        </Button>
      </div>
      {state.message && <Notice kind={state.ok ? "success" : "error"}>{state.message}</Notice>}
    </form>
  );
}

export function RecoveryForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} aria-busy={pending} className="grid gap-5">
      {state.message && !state.ok && <Notice kind="error">{state.message}</Notice>}
      <TextField id="key" label="Setup key" required type="password" autoComplete="off" error={e.key} maxLength={300} hint="The long key you added in Vercel." />
      <TextField id="email" label="E-mail of the account" required type="email" autoComplete="username" defaultValue={state.values?.email} error={e.email} maxLength={254} />
      <TextField id="password" label="New password" required type="password" autoComplete="new-password" error={e.password} maxLength={128} hint={passwordHint} />
      <TextField id="confirm" label="Repeat new password" required type="password" autoComplete="new-password" error={e.confirm} maxLength={128} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
