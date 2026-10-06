import type { EnquiryItem, NewEnquiry } from "@/lib/domain/types";
import type { BulkEnquiryInput, ContactInput } from "@/lib/validation/enquiry";
import type { CatalogueRepository } from "@/lib/repositories/types";

/**
 * Enquiry use-cases.
 *
 * The web forms call these today. Later the WhatsApp webhook and the AI sales
 * agent call the same functions, so every channel produces identical records
 * that land in the same lead / enquiry pipeline.
 */

/** Resolves the enquiry-list items against the catalogue. Unknown slugs (e.g. a stale browser list) are dropped. */
async function resolveItems(items: BulkEnquiryInput["items"], catalogue: CatalogueRepository): Promise<EnquiryItem[]> {
  const resolved: EnquiryItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    const product = await catalogue.getProductBySlug(item.slug);
    if (product) {
      resolved.push({ productId: product.id, productName: product.name, quantityNote: item.quantity });
    }
  }
  return resolved;
}

/** One-line summary of the products, e.g. "Ball Pens (10 boxes); Gel Pens". */
function summariseItems(items: EnquiryItem[]): string {
  return items.map((item) => (item.quantityNote ? `${item.productName} (${item.quantityNote})` : item.productName)).join("; ");
}

export function buildBulkEnquiry(input: BulkEnquiryInput, items: EnquiryItem[]): NewEnquiry {
  const listed = summariseItems(items);
  const typed = input.productsRequired;
  return {
    source: input.kind === "quote" ? "QUOTE_FORM" : "BULK_ORDER_FORM",
    name: input.name,
    organization: input.organization,
    phone: input.phone,
    email: input.email,
    city: input.city,
    state: input.state,
    productsRequired: [listed, typed].filter(Boolean).join("\n"),
    approximateQuantity: input.approximateQuantity,
    additionalRequirements: input.additionalRequirements,
    items,
  };
}

export function buildContactEnquiry(input: ContactInput): NewEnquiry {
  return {
    source: "CONTACT_FORM",
    name: input.name,
    phone: input.phone,
    email: input.email,
    productsRequired: "General enquiry (contact form)",
    additionalRequirements: input.message,
    items: [],
  };
}

/**
 * Validated bulk-order / quote form → enquiry record, ready to store.
 * Resolves the enquiry-list items against the catalogue first.
 */
export async function prepareBulkEnquiry(input: BulkEnquiryInput, catalogue: CatalogueRepository): Promise<NewEnquiry> {
  return buildBulkEnquiry(input, await resolveItems(input.items, catalogue));
}
