import { Boxes, FileText, Headset, PackageCheck, type LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { why } from "@/content/home";

const ICONS: Record<(typeof why.items)[number]["icon"], LucideIcon> = {
  wholesale: PackageCheck,
  range: Boxes,
  quote: FileText,
  support: Headset,
};

export function WhyUs() {
  return (
    <Section labelledBy="why-title">
      <SectionHeading id="why-title" eyebrow={why.eyebrow} title={why.title} />
      <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {why.items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.title} className="reveal">
              <span className="grid size-12 place-items-center rounded-xl bg-accent-100 text-accent-700">
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
