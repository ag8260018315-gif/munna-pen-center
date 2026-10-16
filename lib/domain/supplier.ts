import { siteConfig } from "@/lib/config/site";
import { stateByName } from "@/lib/domain/gst";

/** Who is selling, as printed on a tax invoice. Pure: the GSTIN and legal name are passed in (from the environment). */
export interface InvoiceSupplier {
  gstin: string | null;
  name: string;
  address: string;
  /** GST state code of the business address (from the state the owner gave), or null if that state is not recognised. */
  homeStateCode: string | null;
}

/** "12 Main Road, Dhanbad, Jharkhand - 826001": only the parts that are known, in order. */
export function joinAddress(parts: { line1?: string | null; city?: string | null; state?: string | null; pincode?: string | null }): string {
  const place = [parts.line1, parts.city, parts.state].map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  const text = place.join(", ");
  const pin = parts.pincode?.trim();
  return pin ? (text ? `${text} - ${pin}` : pin) : text;
}

export function buildSupplier(input: { gstin: string | null; legalName?: string | null; region?: string }): InvoiceSupplier {
  const { location, name } = siteConfig;
  const region = input.region ?? location.region;
  return {
    gstin: input.gstin,
    name: input.legalName?.trim() || name,
    address: joinAddress({ line1: location.streetAddress, city: location.locality, state: region, pincode: location.postalCode }),
    homeStateCode: stateByName(region)?.code ?? null,
  };
}
