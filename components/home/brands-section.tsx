import type { Brand } from "@/lib/domain/types";
import { Section, SectionHeading } from "@/components/ui/section";

/**
 * Brands we can supply — plain text names only. No logos and no "authorised dealer" claim: this is the
 * owner's list of brands that can be quoted for, and availability is confirmed per enquiry.
 */
export function BrandsSection({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;
  return (
    <Section tone="surface" labelledBy="brands-title">
      <SectionHeading
        id="brands-title"
        eyebrow="Brands"
        title="Brands we can supply"
        description="Ask us for any of these brands in your quote request. Availability, models and pack sizes are confirmed on enquiry."
      />
      <ul className="mt-10 flex flex-wrap gap-3">
        {brands.map((brand) => (
          <li key={brand.id} className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-card">
            {brand.name}
          </li>
        ))}
      </ul>
    </Section>
  );
}
