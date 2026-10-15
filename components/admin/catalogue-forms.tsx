"use client";

import { useActionState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Notice } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/validation/admin-catalogue";

type Action = (prev: AdminFormState, data: FormData) => Promise<AdminFormState>;
const initial: AdminFormState = {};

export function Checkbox({ id, label, hint, defaultChecked }: { id: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} name={id} type="checkbox" defaultChecked={defaultChecked} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-1 size-5 rounded border-slate-400" />
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {hint && (
          <span id={`${id}-hint`} className="block font-normal text-muted">
            {hint}
          </span>
        )}
      </label>
    </div>
  );
}

export function FormShell({ action, children, submitLabel }: { action: Action; children: (s: AdminFormState) => React.ReactNode; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} aria-busy={pending} className="grid gap-5">
      {state.message && !state.ok && <Notice kind="error">{state.message}</Notice>}
      {state.message && state.ok && <Notice kind="success">{state.message}</Notice>}
      {/* React resets uncontrolled fields after a submit (and keeps a changed <select> default out of the DOM), so the
          fields are remounted with the values the server sent back: nothing the person typed is lost on an error. */}
      <div key={state.values ? JSON.stringify(state.values) : "fresh"} className="grid gap-5">
        {children(state)}
      </div>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const pick = (state: AdminFormState, initialValues: Record<string, string>, key: string) => state.values?.[key] ?? initialValues[key] ?? "";
const checked = (state: AdminFormState, initialValues: Record<string, string>, key: string, fallback: boolean) =>
  state.values ? key in state.values : key in initialValues ? initialValues[key] === "on" : fallback;

interface Option {
  id: string;
  name: string;
  isActive: boolean;
}

export function ProductForm({
  action,
  values,
  categories,
  brands,
  canEditPrices,
  submitLabel,
}: {
  action: Action;
  values: Record<string, string>;
  categories: Option[];
  brands: Option[];
  canEditPrices: boolean;
  submitLabel: string;
}) {
  return (
    <FormShell action={action} submitLabel={submitLabel}>
      {(s) => {
        const e = s.fieldErrors ?? {};
        const v = (k: string) => pick(s, values, k);
        const money = { inputMode: "decimal" as const, disabled: !canEditPrices, maxLength: 14 };
        return (
          <>
            <fieldset className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">Basics</legend>
              <TextField id="name" label="Product name" required defaultValue={v("name")} error={e.name} maxLength={150} containerClassName="sm:col-span-2" />
              <SelectField id="categoryId" label="Category" required defaultValue={v("categoryId")} error={e.categoryId}>
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </SelectField>
              <SelectField id="brandId" label="Brand" defaultValue={v("brandId")} error={e.brandId} hint="Brands are separate from categories.">
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </SelectField>
              <TextField id="shortDescription" label="Short description" defaultValue={v("shortDescription")} error={e.shortDescription} maxLength={300} containerClassName="sm:col-span-2" />
              <TextAreaField id="description" label="Full description" defaultValue={v("description")} error={e.description} maxLength={4000} containerClassName="sm:col-span-2" />
              <TextField id="slug" label="Web address (slug)" defaultValue={v("slug")} error={e.slug} maxLength={80} hint="Leave blank to make it from the name. Lower-case letters, numbers and hyphens." />
              <TextField id="tags" label="Tags" defaultValue={v("tags")} error={e.tags} hint="Comma separated." maxLength={400} />
            </fieldset>

            <fieldset className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">Stock keeping</legend>
              <TextField id="sku" label="SKU" defaultValue={v("sku")} error={e.sku} maxLength={60} hint="Your own code. Leave blank until you assign one." />
              <TextField id="unit" label="Unit" defaultValue={v("unit")} error={e.unit} maxLength={40} hint="e.g. piece, box, dozen." />
              <TextField id="packSize" label="Pack size" defaultValue={v("packSize")} error={e.packSize} maxLength={120} />
              <TextField id="minOrderQuantity" label="Minimum order quantity" defaultValue={v("minOrderQuantity")} error={e.minOrderQuantity} inputMode="numeric" maxLength={9} />
              <TextField id="stockQuantity" label="Stock quantity" defaultValue={v("stockQuantity")} error={e.stockQuantity} inputMode="numeric" maxLength={9} hint="Leave blank if you do not track stock. 0 means out of stock." />
            </fieldset>

            <fieldset className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">Prices and tax (internal — never shown on the website)</legend>
              {!canEditPrices && (
                <div className="sm:col-span-2">
                  <Notice kind="info">Only the owner can enter or change prices, GST and HSN.</Notice>
                </div>
              )}
              <TextField id="purchasePrice" label="Purchase price (₹)" defaultValue={v("purchasePrice")} error={e.purchasePrice} {...money} />
              <TextField id="wholesalePrice" label="Wholesale price (₹)" defaultValue={v("wholesalePrice")} error={e.wholesalePrice} {...money} />
              <TextField id="retailPrice" label="Retail price (₹)" defaultValue={v("retailPrice")} error={e.retailPrice} {...money} />
              <TextField id="gstRatePercent" label="GST rate (%)" defaultValue={v("gstRatePercent")} error={e.gstRatePercent} {...money} maxLength={6} hint="Enter the real rate for this product." />
              <TextField id="hsnCode" label="HSN code" defaultValue={v("hsnCode")} error={e.hsnCode} disabled={!canEditPrices} maxLength={8} inputMode="numeric" />
            </fieldset>

            <fieldset className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">Visibility</legend>
              <SelectField id="status" label="Status" required defaultValue={v("status") || "DRAFT"} error={e.status} hint="Only Active products appear on the website.">
                <option value="DRAFT">Draft — being prepared</option>
                <option value="ACTIVE">Active — shown on the website</option>
                <option value="INACTIVE">Inactive — hidden</option>
              </SelectField>
              <div className="self-center">
                <Checkbox id="isFeatured" label="Featured product" defaultChecked={checked(s, values, "isFeatured", false)} />
              </div>
            </fieldset>
          </>
        );
      }}
    </FormShell>
  );
}

export function BrandForm({ action, values, submitLabel }: { action: Action; values: Record<string, string>; submitLabel: string }) {
  return (
    <FormShell action={action} submitLabel={submitLabel}>
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="name" label="Brand name" required defaultValue={pick(s, values, "name")} error={e.name} maxLength={80} />
            <TextField id="slug" label="Web address (slug)" defaultValue={pick(s, values, "slug")} error={e.slug} maxLength={80} hint="Leave blank to make it from the name." />
            <TextField id="sortOrder" label="Sort order" defaultValue={pick(s, values, "sortOrder") || "0"} error={e.sortOrder} inputMode="numeric" maxLength={5} />
            <div className="grid gap-4 self-center">
              <Checkbox id="isActive" label="Active" hint="Untick to deactivate. Products keep their brand." defaultChecked={checked(s, values, "isActive", true)} />
              <Checkbox id="isListedPublicly" label="Show on the website" hint="Only tick once you have confirmed the brand may be shown." defaultChecked={checked(s, values, "isListedPublicly", false)} />
            </div>
          </div>
        );
      }}
    </FormShell>
  );
}

export function CategoryForm({ action, values, submitLabel }: { action: Action; values: Record<string, string>; submitLabel: string }) {
  return (
    <FormShell action={action} submitLabel={submitLabel}>
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <TextField id="name" label="Category name" required defaultValue={pick(s, values, "name")} error={e.name} maxLength={80} />
            <TextField id="slug" label="Web address (slug)" defaultValue={pick(s, values, "slug")} error={e.slug} maxLength={80} hint="Leave blank to make it from the name. Changing it changes the page address." />
            <TextField id="summary" label="Short summary" defaultValue={pick(s, values, "summary")} error={e.summary} maxLength={300} containerClassName="sm:col-span-2" />
            <TextAreaField id="description" label="Description" defaultValue={pick(s, values, "description")} error={e.description} maxLength={4000} containerClassName="sm:col-span-2" />
            <TextField id="sortOrder" label="Sort order" defaultValue={pick(s, values, "sortOrder") || "0"} error={e.sortOrder} inputMode="numeric" maxLength={5} />
            <div className="self-center">
              <Checkbox id="isActive" label="Active" hint="Untick to hide the category from the website." defaultChecked={checked(s, values, "isActive", true)} />
            </div>
          </div>
        );
      }}
    </FormShell>
  );
}

export function StockRowForm({ action, id, label, value }: { action: Action; id: string; label: string; value: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const inputId = `stock-${id}`;
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Stock for {label}
      </label>
      <input
        id={inputId}
        name="stockQuantity"
        defaultValue={state.values?.stockQuantity ?? value}
        inputMode="numeric"
        maxLength={9}
        placeholder="Not tracked"
        aria-invalid={state.message && !state.ok ? true : undefined}
        aria-describedby={state.message ? `${inputId}-msg` : undefined}
        className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.message && (
        <span id={`${inputId}-msg`} role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-emerald-800" : "text-sm font-semibold text-red-700"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
