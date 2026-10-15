import { siteConfig } from "@/lib/config/site";

/** Who is selling, as printed on a tax invoice. Pure: the GSTIN and legal name are passed in (from the environment). */
export interface InvoiceSupplier {
  gstin: string | null;
  name: string;
  address: string;
}

/** "12 Main Road, Dhanbad, Jharkhand - 826001": only the parts that are known, in order. */
export function joinAddress(parts: { line1?: string | null; city?: string | null; state?: string | null; pincode?: string | null }): string {
  const place = [parts.line1, parts.city, parts.state].map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  const text = place.join(", ");
  const pin = parts.pincode?.trim();
  return pin ? (text ? `${text} - ${pin}` : pin) : text;
}

export function buildSupplier(input: { gstin: string | null; legalName?: string | null }): InvoiceSupplier {
  const { location, name } = siteConfig;
  return {
    gstin: input.gstin,
    name: input.legalName?.trim() || name,
    address: joinAddress({ line1: location.streetAddress, city: location.locality, state: location.region, pincode: location.postalCode }),
  };
}
