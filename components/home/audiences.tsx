import { Briefcase, Building2, DraftingCompass, GraduationCap, Landmark, Store, type LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { audiences } from "@/content/home";

const ICONS: Record<(typeof audiences.items)[number]["icon"], LucideIcon> = {
  school: GraduationCap,
  office: Building2,
  engineer: DraftingCompass,
  business: Briefcase,
  institution: Landmark,
  retailer: Store,
};

export function Audiences() {
  return (
    <Section tone="surface" labelledBy="audiences-title">
      <SectionHeading id="audiences-title" eyebrow={audiences.eyebrow} title={audiences.title} description={audiences.description} />
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {audiences.items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.name} className="reveal flex gap-4 rounded-2xl border border-line bg-white p-6 shadow-card">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-bold">{item.name}</h3>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
