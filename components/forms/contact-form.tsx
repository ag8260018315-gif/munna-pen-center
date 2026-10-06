"use client";

import { useActionState, useState } from "react";
import { submitContactAction } from "@/app/actions/enquiry";
import { Honeypot, TextAreaField, TextField } from "@/components/forms/fields";
import { FormErrorBanner, FormSuccess, PendingLabel } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/validation/limits";
import { initialFormState } from "@/lib/validation/form-state";

export function ContactForm() {
  const [formKey, setFormKey] = useState(0);
  return <ContactFormInner key={formKey} onReset={() => setFormKey((key) => key + 1)} />;
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(submitContactAction, initialFormState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (state.status === "success") {
    return (
      <FormSuccess
        title="Your message has been received"
        reference={state.reference}
        whatsappUrl={state.whatsappUrl}
        onReset={onReset}
        resetLabel="Send another message"
      />
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="relative grid gap-5">
      <input type="hidden" name="kind" value="contact" />
      {state.status === "error" && <FormErrorBanner state={state} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" label="Name" required autoComplete="name" maxLength={LIMITS.name} defaultValue={values.name} error={errors.name} />
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
      </div>
      <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" maxLength={LIMITS.email} defaultValue={values.email} error={errors.email} />
      <TextAreaField
        id="message"
        label="Message"
        required
        rows={5}
        maxLength={LIMITS.contactMessage}
        defaultValue={values.message}
        error={errors.message}
        hint="Tell us what you need — products, approximate quantities and your city."
      />

      <Honeypot />

      <div className="grid gap-3">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? <PendingLabel label="Sending…" /> : "Send Message"}
        </Button>
        <p className="text-sm text-muted">We use these details only to respond to your message. Fields marked * are required.</p>
      </div>
    </form>
  );
}
