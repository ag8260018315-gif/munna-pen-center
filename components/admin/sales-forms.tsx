"use client";

import { useActionState } from "react";
import { FormShell, pick } from "@/components/admin/catalogue-forms";
import { Notice } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL } from "@/lib/validation/admin-sales";
import type { AdminFormState } from "@/lib/validation/admin-catalogue";

type Action = (prev: AdminFormState, data: FormData) => Promise<AdminFormState>;
const initial: AdminFormState = {};

export function CustomerForm({ action, values, submitLabel }: { action: Action; values: Record<string, string>; submitLabel: string }) {
  return (
    <FormShell action={action} submitLabel={submitLabel}>
      {(s) => {
        const e = s.fieldErrors ?? {};
        const v = (k: string) => pick(s, values, k);
        return (
          <>
            <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <TextField id="organizationName" label="Organisation or shop" required defaultValue={v("organizationName")} error={e.organizationName} maxLength={150} />
              <SelectField id="type" label="Type" required defaultValue={v("type") || "OTHER"} error={e.type}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CUSTOMER_TYPE_LABEL[t]}
                  </option>
                ))}
              </SelectField>
              <TextField id="contactName" label="Contact person" required autoComplete="off" defaultValue={v("contactName")} error={e.contactName} maxLength={100} />
              <TextField id="phone" label="Phone / WhatsApp" required type="tel" inputMode="tel" defaultValue={v("phone")} error={e.phone} maxLength={20} hint="10-digit mobile number." />
              <TextField id="email" label="E-mail" type="email" defaultValue={v("email")} error={e.email} maxLength={254} />
              <TextField id="gstin" label="Customer's GSTIN" defaultValue={v("gstin")} error={e.gstin} maxLength={20} hint="Only if they gave it to you. Needed later for GST invoices." />
            </div>
            <fieldset className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">Billing address (optional)</legend>
              <TextField id="billingLine1" label="Address" defaultValue={v("billingLine1")} error={e.billingLine1} maxLength={200} containerClassName="sm:col-span-2" />
              <TextField id="billingCity" label="City" defaultValue={v("billingCity")} error={e.billingCity} maxLength={80} />
              <TextField id="billingState" label="State" defaultValue={v("billingState")} error={e.billingState} maxLength={80} />
              <TextField id="billingPincode" label="PIN code" defaultValue={v("billingPincode")} error={e.billingPincode} inputMode="numeric" maxLength={6} />
            </fieldset>
            <TextAreaField id="notes" label="Notes" defaultValue={v("notes")} error={e.notes} maxLength={2000} />
          </>
        );
      }}
    </FormShell>
  );
}

export function NewQuoteForm({ action, customers }: { action: Action; customers: { id: string; organizationName: string; contactName: string }[] }) {
  return (
    <FormShell action={action} submitLabel="Create draft quotation">
      {(s) => (
        <SelectField id="customerId" label="Customer" required defaultValue={s.values?.customerId ?? ""} error={s.fieldErrors?.customerId}>
          <option value="">Choose…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.organizationName} — {c.contactName}
            </option>
          ))}
        </SelectField>
      )}
    </FormShell>
  );
}

export function QuoteHeaderForm({ action, values }: { action: Action; values: Record<string, string> }) {
  return (
    <FormShell action={action} submitLabel="Save details">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="validUntil" label="Valid until" type="date" defaultValue={pick(s, values, "validUntil")} error={e.validUntil} hint="Leave blank if the quotation has no expiry." />
            <div />
            <TextAreaField id="terms" label="Terms" defaultValue={pick(s, values, "terms")} error={e.terms} maxLength={4000} hint="Payment, delivery or anything else you want the customer to read. Nothing is filled in for you." containerClassName="sm:col-span-2" />
            <TextAreaField id="notes" label="Internal notes" defaultValue={pick(s, values, "notes")} error={e.notes} maxLength={2000} hint="Not shown to the customer." containerClassName="sm:col-span-2" />
          </div>
        );
      }}
    </FormShell>
  );
}

interface LineValues {
  description?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  gstRatePercent?: string;
  hsnCode?: string;
}

/** One quotation line: used to edit an existing line (`values` given) or to add a new one (`products` given). */
export function LineForm({
  action,
  lineKey,
  values,
  products,
  canEditPrices,
  mode,
  customerNote,
}: {
  action: Action;
  lineKey: string;
  values: LineValues;
  products?: { id: string; name: string }[];
  canEditPrices: boolean;
  mode: "add" | "edit";
  customerNote?: string | null;
}) {
  return (
    <FormShell action={action} submitLabel={mode === "add" ? "Add line" : "Save line"}>
      {(s) => {
        const e = s.fieldErrors ?? {};
        const v = (k: keyof LineValues) => s.values?.[k] ?? values[k] ?? "";
        // Several line forms share one page: ids must be unique, while the submitted field names stay plain.
        const f = (k: string) => ({ id: `${k}-${lineKey}`, name: k });
        return (
          <div className="grid gap-4 sm:grid-cols-6">
            {mode === "add" && products && (
              <SelectField {...f("productId")} label="Product (optional)" defaultValue={s.values?.productId ?? ""} error={e.productId} containerClassName="sm:col-span-6" hint="Choosing a product fills the blank boxes below from it. The owner also gets its wholesale price.">
                <option value="">— none, type a description —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            )}
            {customerNote && <p className="text-sm text-muted sm:col-span-6">Customer wrote: “{customerNote}”</p>}
            <TextField {...f("description")} label="Description" required={mode === "edit"} defaultValue={v("description")} error={e.description} maxLength={300} containerClassName="sm:col-span-6" />
            <TextField {...f("quantity")} label="Quantity" required defaultValue={v("quantity") || (mode === "add" ? "1" : "")} error={e.quantity} inputMode="numeric" maxLength={8} containerClassName="sm:col-span-2" />
            <TextField {...f("unit")} label="Unit" required defaultValue={v("unit") || (mode === "add" ? "pcs" : "")} error={e.unit} maxLength={20} containerClassName="sm:col-span-2" />
            <TextField {...f("unitPrice")} label="Price per unit (₹, ex-GST)" defaultValue={v("unitPrice")} error={e.unitPrice} inputMode="decimal" maxLength={14} disabled={!canEditPrices} containerClassName="sm:col-span-2" />
            <TextField {...f("gstRatePercent")} label="GST rate (%)" defaultValue={v("gstRatePercent")} error={e.gstRatePercent} inputMode="decimal" maxLength={6} disabled={!canEditPrices} containerClassName="sm:col-span-3" />
            <TextField {...f("hsnCode")} label="HSN code" defaultValue={v("hsnCode")} error={e.hsnCode} inputMode="numeric" maxLength={8} disabled={!canEditPrices} containerClassName="sm:col-span-3" />
          </div>
        );
      }}
    </FormShell>
  );
}

/** Owner buttons: each one is its own tiny form so a refusal is shown in place. */
export function StatusButton({ action, label, variant = "secondary" }: { action: Action; label: string; variant?: "primary" | "secondary" }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-2">
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? "Please wait…" : label}
      </Button>
      {state.message && <Notice kind="error">{state.message}</Notice>}
    </form>
  );
}
