"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import type { FormState } from "@/lib/validation/form-state";

/**
 * Moves keyboard / screen-reader focus to `element` AND scrolls it into view. A bare `focus()` does not
 * reliably scroll under the sticky header, and the form can be much taller than the panel that replaces it.
 */
function focusAndReveal(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
}

/** Error banner shown above a form. Takes focus when it appears so screen-reader users hear it. */
export function FormErrorBanner({ state }: { state: Extract<FormState, { status: "error" }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusAndReveal(ref.current);
  }, [state]);

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 focus:outline-none sm:p-5">
      <p className="flex items-start gap-2.5 font-semibold">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
      {state.whatsappUrl && (
        <div className="mt-4">
          <ExternalButtonLink href={state.whatsappUrl} variant="whatsapp" size="md">
            <WhatsAppIcon className="size-5" />
            Send on WhatsApp instead
          </ExternalButtonLink>
        </div>
      )}
    </div>
  );
}

/** Success panel that replaces the form after a submission is received. */
export function FormSuccess({
  title,
  reference,
  whatsappUrl,
  onReset,
  resetLabel,
}: {
  title: string;
  reference: string;
  whatsappUrl: string;
  onReset: () => void;
  resetLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusAndReveal(ref.current);
  }, []);

  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 focus:outline-none sm:p-8">
      <div className="flex items-start gap-4">
        <CheckCircle2 className="mt-1 size-8 shrink-0 text-emerald-700" aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-extrabold text-emerald-950">{title}</h2>
          {reference !== "ENQ-RECEIVED" && (
            <p className="mt-2 text-emerald-900">
              Your reference: <strong className="rounded bg-white px-2 py-0.5 font-mono text-sm">{reference}</strong>
            </p>
          )}
          <p className="mt-3 max-w-xl leading-relaxed text-emerald-900">
            Thank you for contacting Munna Pen Center. We will review your requirement and get back to you on the phone / WhatsApp number you shared.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-900/80">
            For a quicker response you can also send the same details on WhatsApp — the message is already filled in.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ExternalButtonLink href={whatsappUrl} variant="whatsapp" size="md">
              <WhatsAppIcon className="size-5" />
              Send on WhatsApp too
            </ExternalButtonLink>
            <ButtonLink href="/products" variant="secondary" size="md">
              Browse products
            </ButtonLink>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-[0.95rem] font-semibold text-emerald-900 underline underline-offset-4 hover:bg-emerald-100"
            >
              {resetLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PendingLabel({ label }: { label: string }) {
  return (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </>
  );
}
