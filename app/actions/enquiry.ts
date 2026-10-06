"use server";

import { getCatalogue, getEnquiryRepository } from "@/lib/repositories";
import { StorageUnavailableError } from "@/lib/repositories/types";
import { withTimeout } from "@/lib/repositories/with-timeout";
import { buildContactEnquiry, prepareBulkEnquiry } from "@/lib/services/enquiries";
import type { NewEnquiry } from "@/lib/domain/types";
import { bulkEnquirySchema, contactSchema, readItems, readValues, toFieldErrors } from "@/lib/validation/enquiry";
import type { FormState } from "@/lib/validation/form-state";
import { buildEnquiryWhatsAppMessage, buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

/**
 * Server actions behind the enquiry forms. They run only on the server, so no
 * storage path or credential ever reaches the browser.
 *
 * Flow: parse FormData → validate (zod) → honeypot check → prepare record → repository.
 * If the enquiry cannot be stored the customer still gets a one-tap WhatsApp
 * fallback with their requirement pre-filled, so a lead is never lost silently.
 */

/** How long a customer waits on "Sending…" before being offered the WhatsApp fallback. */
const STORAGE_TIMEOUT_MS = 8_000;

const GENERIC_ERROR = "Something went wrong. Please try again, or send your requirement on WhatsApp.";
const VALIDATION_ERROR = "Please check the highlighted fields and try again.";

/** Stores the record, or returns an error state carrying a WhatsApp fallback. */
async function store(
  record: NewEnquiry,
  values: Record<string, string>,
  intro: string,
  messages: { storageFailed: string },
): Promise<FormState> {
  try {
    const enquiry = await withTimeout(getEnquiryRepository().create(record), STORAGE_TIMEOUT_MS);
    return {
      status: "success",
      reference: enquiry.reference,
      whatsappUrl: buildWhatsAppUrl(buildEnquiryWhatsAppMessage({ ...record, reference: enquiry.reference }, intro)),
    };
  } catch (error) {
    const fallbackUrl = buildWhatsAppUrl(buildEnquiryWhatsAppMessage(record, intro));
    if (error instanceof StorageUnavailableError) {
      console.error("[enquiry] storage unavailable:", error.cause ?? error.message);
      return { status: "error", message: messages.storageFailed, values, whatsappUrl: fallbackUrl };
    }
    console.error("[enquiry] unexpected error:", error);
    return { status: "error", message: GENERIC_ERROR, values, whatsappUrl: fallbackUrl };
  }
}

/** Bots fill the hidden field. Report success so they don't adapt, and store nothing. */
const silentSuccess = (intro: string): FormState => ({
  status: "success",
  reference: "ENQ-RECEIVED",
  whatsappUrl: buildWhatsAppUrl(intro),
});

export async function submitBulkEnquiryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData);
  const parsed = bulkEnquirySchema.safeParse({ ...Object.fromEntries(formData.entries()), items: readItems(formData) });

  if (!parsed.success) {
    return { status: "error", message: VALIDATION_ERROR, fieldErrors: toFieldErrors(parsed.error), values };
  }
  if (parsed.data.website) return silentSuccess(whatsAppMessages.bulkOrder);

  const record = await prepareBulkEnquiry(parsed.data, getCatalogue());
  if (!record.productsRequired) {
    // Every listed product was stale/unknown and nothing was typed.
    return {
      status: "error",
      message: VALIDATION_ERROR,
      fieldErrors: { productsRequired: "Please tell us which products you need" },
      values,
    };
  }
  return store(record, values, whatsAppMessages.bulkOrder, {
    storageFailed:
      "We could not save your enquiry automatically. Please send it to us on WhatsApp — your details are already filled in.",
  });
}

export async function submitContactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData);
  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { status: "error", message: VALIDATION_ERROR, fieldErrors: toFieldErrors(parsed.error), values };
  }
  if (parsed.data.website) return silentSuccess(whatsAppMessages.general);

  return store(buildContactEnquiry(parsed.data), values, whatsAppMessages.general, {
    storageFailed: "We could not save your message automatically. Please message us on WhatsApp instead.",
  });
}
