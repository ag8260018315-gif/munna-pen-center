import { Check } from "lucide-react";
import { SupplyNetwork } from "@/components/illustrations/supply-network";
import { ButtonLink } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/ui/section";
import { delivery } from "@/content/home";

export function Delivery() {
  return (
    <Section tone="brand" labelledBy="delivery-title">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading id="delivery-title" tone="dark" eyebrow={delivery.eyebrow} title={delivery.title} description={delivery.description} />
          <ul className="mt-8 grid gap-4">
            {delivery.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-brand-50">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent-400 text-brand-950">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <ButtonLink href="/request-quote" size="lg" className="mt-10">
            {delivery.cta}
          </ButtonLink>
        </div>
        <div className="reveal">
          <SupplyNetwork className="h-auto w-full rounded-[28px] shadow-lift" />
        </div>
      </div>
    </Section>
  );
}
