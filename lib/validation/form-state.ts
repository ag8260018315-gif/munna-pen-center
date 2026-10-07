/** State returned by the enquiry server actions and consumed by `useActionState` in the forms. */
export type FormState =
  | { status: "idle" }
  | {
      status: "success";
      /** Reference the customer can quote, e.g. ENQ-20261006-K4PZ. */
      reference: string;
      /** Optional "also send this on WhatsApp" link for a faster reply. */
      whatsappUrl: string;
    }
  | {
      status: "error";
      message: string;
      /** First error message per field name. */
      fieldErrors?: Record<string, string>;
      /** Submitted values, so the form can be re-populated after a validation error. */
      values?: Record<string, string>;
      /** Present when the enquiry could not be saved: lets the customer send it on WhatsApp instead. */
      whatsappUrl?: string;
    };

export const initialFormState: FormState = { status: "idle" };
