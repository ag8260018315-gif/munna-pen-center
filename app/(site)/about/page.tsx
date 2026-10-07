import { Building2, MapPin, PackageCheck, Receipt, Truck } from "lucide-react";
import { CtaBand } from "@/components/home/cta-band";
import { Container, PageHeader } from "@/components/ui/section";
import { about } from "@/content/about";
import { pageSeo } from "@/content/seo";
import { siteConfig } from "@/lib/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ ...pageSeo.about, path: "/about" });

export default function AboutPage() {
  const { location, gst } = siteConfig;
  const facts = [
    { icon: Building2, label: "Business", value: "Wholesale stationery & office supplies" },
    { icon: MapPin, label: "Location", value: `${location.locality}, ${location.region}, ${location.country}` },
    { icon: Truck, label: "Supply area", value: "All India" },
    ...(gst.registered ? [{ icon: Receipt, label: "GST", value: "GST registered" }] : []),
    ...(about.established ? [{ icon: PackageCheck, label: "Established", value: about.established }] : []),
  ];

  return (
    <>
      <PageHeader eyebrow={about.eyebrow} title={about.headline} description={about.intro} />

      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="grid max-w-3xl gap-12">
          {about.story && (
            <section aria-labelledby="story-title">
              <h2 id="story-title" className="text-2xl font-extrabold sm:text-3xl">
                Our story
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">{about.story}</p>
            </section>
          )}
          {about.sections.map((section) => (
            <section key={section.title} aria-labelledby={`about-${section.title.replace(/\s+/g, "-").toLowerCase()}`}>
              <h2 id={`about-${section.title.replace(/\s+/g, "-").toLowerCase()}`} className="text-2xl font-extrabold sm:text-3xl">
                {section.title}
              </h2>
              <div className="mt-4 grid gap-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-lg leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside aria-labelledby="facts-title" className="h-fit rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-28">
          <h2 id="facts-title" className="text-lg font-extrabold">
            At a glance
          </h2>
          <dl className="mt-5 grid gap-5">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-card">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {label}
                </dt>
                <dd className="mt-1.5 pl-[2.625rem] font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </Container>

      <CtaBand title="Talk to us about your requirement" description="Share the products and quantities you need and we will respond with a wholesale quotation." />
    </>
  );
}
