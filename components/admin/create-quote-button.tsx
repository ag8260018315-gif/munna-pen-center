"use client";

import { useActionState } from "react";
import { Notice } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/validation/admin-catalogue";

export function CreateQuoteButton({ action, label }: { action: (prev: AdminFormState, data: FormData) => Promise<AdminFormState>; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Please wait…" : label}
        </Button>
      </div>
      {state.message && <Notice kind="error">{state.message}</Notice>}
    </form>
  );
}
