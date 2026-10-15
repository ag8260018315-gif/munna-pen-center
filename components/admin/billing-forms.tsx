"use client";

import { useActionState } from "react";
import { Checkbox, FormShell, pick } from "@/components/admin/catalogue-forms";
import { Notice } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/validation/admin-catalogue";

type Action = (prev: AdminFormState, data: FormData) => Promise<AdminFormState>;

/** A single button that runs an action (create an order, create a draft invoice…). A refusal is shown in place. */
export function ActionButton({ action, label, variant = "primary" }: { action: Action; label: string; variant?: "primary" | "secondary" }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <div>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? "Please wait…" : label}
        </Button>
      </div>
      {state.message && <Notice kind="error">{state.message}</Notice>}
    </form>
  );
}

// ───────────────────────────── orders ─────────────────────────────

export function OrderDetailsForm({ action, values }: { action: Action; values: Record<string, string> }) {
  return (
    <FormShell action={action} submitLabel="Save delivery details">
      {(s) => {
        const e = s.fieldErrors ?? {};
        const v = (k: string) => pick(s, values, k);
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="shippingLine1" label="Delivery address" defaultValue={v("shippingLine1")} error={e.shippingLine1} maxLength={200} containerClassName="sm:col-span-2" />
            <TextField id="shippingCity" label="City" defaultValue={v("shippingCity")} error={e.shippingCity} maxLength={80} />
            <TextField id="shippingState" label="State" defaultValue={v("shippingState")} error={e.shippingState} maxLength={80} hint="Decides whether the invoice carries CGST + SGST or IGST." />
            <TextField id="shippingPincode" label="PIN code" defaultValue={v("shippingPincode")} error={e.shippingPincode} inputMode="numeric" maxLength={6} />
            <TextAreaField id="notes" label="Internal notes" defaultValue={v("notes")} error={e.notes} maxLength={2000} hint="Not shown to the customer." containerClassName="sm:col-span-2" />
          </div>
        );
      }}
    </FormShell>
  );
}

export function DispatchForm({ action }: { action: Action }) {
  return (
    <FormShell action={action} submitLabel="Mark as dispatched">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="transporter" label="Transporter or courier" defaultValue={pick(s, {}, "transporter")} error={e.transporter} maxLength={120} />
            <TextField id="trackingReference" label="LR number or tracking reference" defaultValue={pick(s, {}, "trackingReference")} error={e.trackingReference} maxLength={120} />
          </div>
        );
      }}
    </FormShell>
  );
}

// ───────────────────────────── invoices ─────────────────────────────

export function InvoiceDraftForm({ action, values, states }: { action: Action; values: Record<string, string>; states: { code: string; name: string }[] }) {
  return (
    <FormShell action={action} submitLabel="Save">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <SelectField id="placeOfSupplyCode" label="Place of supply (state the goods go to)" required defaultValue={pick(s, values, "placeOfSupplyCode")} error={e.placeOfSupplyCode} hint="For goods this is where they are delivered. It decides CGST + SGST (same state as you) or IGST (any other state).">
              <option value="">Choose…</option>
              {states.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.code} — {st.name}
                </option>
              ))}
            </SelectField>
            <TextField id="dueDate" label="Payment due date" type="date" defaultValue={pick(s, values, "dueDate")} error={e.dueDate} hint="Only if you have agreed one with the customer. Leave blank otherwise." />
          </div>
        );
      }}
    </FormShell>
  );
}

/** One small form per line: the HSN code (owner only). */
export function LineHsnForm({ action, lineKey, value, disabled }: { action: Action; lineKey: string; value: string; disabled: boolean }) {
  return (
    <FormShell action={action} submitLabel="Save HSN">
      {(s) => <TextField id={`hsnCode-${lineKey}`} name="hsnCode" label="HSN code" defaultValue={pick(s, { hsnCode: value }, "hsnCode")} error={s.fieldErrors?.hsnCode} inputMode="numeric" maxLength={8} disabled={disabled} />}
    </FormShell>
  );
}

export function IssueInvoiceForm({ action, ready, blocker }: { action: Action; ready: boolean; blocker?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} aria-busy={pending} className="grid gap-4">
      {state.message && <Notice kind="error">{state.message}</Notice>}
      <Checkbox id="checked" label="I have checked the buyer, the items, the place of supply and the tax split." hint="Once issued, an invoice gets its number and can never be edited. A wrong one can only be voided (and only before any payment)." />
      {state.fieldErrors?.checked && <p className="-mt-2 text-sm font-medium text-red-700">{state.fieldErrors.checked}</p>}
      {blocker && <Notice kind="info">{blocker}</Notice>}
      <div>
        <Button type="submit" size="lg" disabled={pending || !ready}>
          {pending ? "Issuing…" : "Issue tax invoice"}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── payments ─────────────────────────────

export function PaymentForm({ action, today, methods, outstanding }: { action: Action; today: string; methods: { value: string; label: string }[]; outstanding: string }) {
  return (
    <FormShell action={action} submitLabel="Record payment">
      {(s) => {
        const e = s.fieldErrors ?? {};
        const v = (k: string, fallback = "") => s.values?.[k] ?? fallback;
        return (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="amount" label="Amount received (₹)" required defaultValue={v("amount")} error={e.amount} inputMode="decimal" maxLength={14} hint={`Still owed: ${outstanding}. Record only money that has already arrived.`} />
            <SelectField id="method" label="How it was paid" required defaultValue={v("method")} error={e.method}>
              <option value="">Choose…</option>
              {methods.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectField>
            <TextField id="paidOn" label="Date received" type="date" required defaultValue={v("paidOn", today)} error={e.paidOn} />
            <TextField id="reference" label="Reference" defaultValue={v("reference")} error={e.reference} maxLength={100} hint="UTR, UPI transaction id or cheque number." />
            <TextAreaField id="notes" label="Note" defaultValue={v("notes")} error={e.notes} maxLength={500} containerClassName="sm:col-span-2" className="min-h-20" />
          </div>
        );
      }}
    </FormShell>
  );
}

/** A reason box with one button: voiding an invoice, reversing a payment. */
export function ReasonForm({ action, id, label, submitLabel }: { action: Action; id: string; label: string; submitLabel: string }) {
  return (
    <FormShell action={action} submitLabel={submitLabel}>
      {(s) => <TextField id={id} name="reason" label={label} required defaultValue={s.values?.reason ?? ""} error={s.fieldErrors?.reason} maxLength={300} />}
    </FormShell>
  );
}
