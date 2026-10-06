import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centred page container with consistent gutters. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

type Tone = "white" | "surface" | "brand";

const tones: Record<Tone, string> = {
  white: "bg-white",
  surface: "bg-surface",
  brand: "on-dark bg-brand-900 text-white",
};

export function Section({
  tone = "white",
  className,
  children,
  id,
  labelledBy,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className={cn("mb-3 text-sm font-bold uppercase tracking-[0.14em]", dark ? "text-accent-300" : "text-brand-600")}>{eyebrow}</p>
      )}
      <h2 id={id} className={cn("text-3xl font-extrabold leading-tight sm:text-4xl", dark && "text-white")}>
        {title}
      </h2>
      {description && <p className={cn("mt-4 text-lg leading-relaxed", dark ? "text-brand-100" : "text-muted")}>{description}</p>}
    </div>
  );
}

/** Page title block for inner pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-brand-50">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <Container className="relative py-12 sm:py-16">
        {breadcrumbs}
        {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
        <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.1] sm:text-5xl">{title}</h1>
        {description && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </div>
  );
}
