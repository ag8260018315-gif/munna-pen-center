import { Section, SectionHeading } from "@/components/ui/section";
import { process } from "@/content/home";

export function HowItWorks() {
  return (
    <Section tone="surface" labelledBy="process-title">
      <SectionHeading id="process-title" eyebrow={process.eyebrow} title={process.title} />
      <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {process.steps.map((step, index) => (
          <li key={step.title} className="reveal relative rounded-2xl border border-line bg-white p-6 shadow-card">
            <span className="grid size-10 place-items-center rounded-full bg-brand-800 font-display text-lg font-extrabold text-white">{index + 1}</span>
            <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
