"use client";

import { useActionState, useEffect, useState } from "react";
import { submitBulkEnquiryAction } from "@/app/actions/enquiry";
import { EnquiryListEditor } from "@/components/forms/enquiry-list-editor";
import { Honeypot, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { FormErrorBanner, FormSuccess, PendingLabel } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { enquiryList } from "@/lib/client/enquiry-list";
import { INDIA_STATES_AND_UTS } from "@/lib/domain/india";
import { LIMITS } from "@/lib/validation/limits";
import { initialFormState } from "@/lib/validation/form-state";

interface EnquiryFormProps {
  /** `quote` shows the enquiry list above the fields. */
  kind: "bulk-order" | "quote";
  /** A product to put on the enquiry list on arrival (from a product's "Request Quote" button). */
  preselect?: { slug: string; name: string };
  /** Prefills "Products Required", e.g. when the visitor came from an empty search. */
  defaultProducts?: string;
}

export function EnquiryForm(props: EnquiryFormProps) {
  // Bumping the key remounts the form, which resets useActionState — used by "Submit another enquiry".
  const [formKey, setFormKey] = useState(0);
  // The URL seed (?product= / ?need=) belongs to the first form only: "Submit another enquiry" starts clean.
  const seed = formKey === 0 ? props : { ...props, preselect: undefined, defaultProducts: undefined };
  return <EnquiryFormInner key={formKey} {...seed} onReset={() => setFormKey((key) => key + 1)} />;
}

function EnquiryFormInner({ kind, preselect, defaultProducts, onReset }: EnquiryFormProps & { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(submitBulkEnquiryAction, initialFormState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  // The list has been sent — start the next enquiry with an empty list.
  // Only the quote form submits the list. The Bulk Orders form is free text: clearing there would silently
  // throw away products the visitor chose and never sent.
  useEffect(() => {
    if (state.status === "success" && kind === "quote") enquiryList.clear();
  }, [state.status, kind]);

  if (state.status === "success") {
    return (
      <FormSuccess
        title={kind === "quote" ? "Your quote request has been received" : "Your bulk enquiry has been received"}
        reference={state.reference}
        whatsappUrl={state.whatsappUrl}
        onReset={onReset}
        resetLabel="Submit another enquiry"
      />
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="relative grid gap-6">
      <input type="hidden" name="kind" value={kind} />
      {state.status === "error" && <FormErrorBanner state={state} />}

      {kind === "quote" && <EnquiryListEditor preselect={preselect} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" label="Name" required autoComplete="name" maxLength={LIMITS.name} defaultValue={values.name} error={errors.name} />
        <TextField
          id="organization"
          label="Business / Organization Name"
          autoComplete="organization"
          maxLength={LIMITS.organization}
          defaultValue={values.organization}
          error={errors.organization}
        />
        <TextField
          id="phone"
          label="Phone / WhatsApp"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="10-digit mobile number"
          maxLength={20}
          defaultValue={values.phone}
          error={errors.phone}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          defaultValue={values.email}
          error={errors.email}
        />
        <TextField id="city" label="City" required autoComplete="address-level2" maxLength={LIMITS.city} defaultValue={values.city} error={errors.city} />
        {/* React resets uncontrolled fields after a form action but does not re-apply a changed
            `defaultValue` to a <select>, so remount it when the returned value changes. */}
        <SelectField
          key={values.state ?? "unset"}
          id="state"
          label="State"
          required
          autoComplete="address-level1"
          defaultValue={values.state ?? ""}
          error={errors.state}
        >
          <option value="" disabled>
            Select state / UT
          </option>
          {INDIA_STATES_AND_UTS.map((stateName) => (
            <option key={stateName} value={stateName}>
              {stateName}
            </option>
          ))}
        </SelectField>
      </div>

      <TextAreaField
        id="productsRequired"
        label="Products Required"
        required={kind !== "quote"}
        rows={4}
        maxLength={LIMITS.productsRequired}
        defaultValue={values.productsRequired ?? defaultProducts}
        error={errors.productsRequired}
        hint={
          kind === "quote"
            ? "Anything not on your list above — items, sizes, colours or brands."
            : "List the products you need — for example: ball pens, A4 copier paper, registers, calculators."
        }
      />

      <TextField
        id="approximateQuantity"
        label="Approximate Quantity"
        maxLength={LIMITS.approximateQuantity}
        placeholder="e.g. 500 pens, 50 registers"
        defaultValue={values.approximateQuantity}
        error={errors.approximateQuantity}
      />

      <TextAreaField
        id="additionalRequirements"
        label="Additional Requirements"
        rows={3}
        maxLength={LIMITS.additionalRequirements}
        defaultValue={values.additionalRequirements}
        error={errors.additionalRequirements}
        hint="Preferred brands, delivery location or timing, recurring supply, anything else we should know."
      />

      <Honeypot />

      <div className="grid gap-3">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? <PendingLabel label="Sending…" /> : "Request Wholesale Quote"}
        </Button>
        <p className="text-sm text-muted">We use these details only to respond to your enquiry. Fields marked * are required.</p>
      </div>
    </form>
  );
}
