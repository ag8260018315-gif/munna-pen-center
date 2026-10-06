import { ContactForm } from "@/components/forms/contact-form";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/ui/section";
import { siteConfig } from "@/lib/config/site";
import { pageMetadata } from "@/lib/seo";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

export const metadata = pageMetadata({
  title: "Contact Munna Pen Center – Wholesale Stationery, Dhanbad",
  description: `Contact Munna Pen Center in Dhanbad, Jharkhand for wholesale stationery requirements and bulk orders. Call or WhatsApp ${siteConfig.contact.phoneDisplay}, or send us a message.`,
  path: "/contact",
});

export default function ContactPage() {
  const { contact, location } = siteConfig;
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Contact Munna Pen Center"
        description="Contact us for wholesale stationery requirements and bulk orders."
      />

      <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[22rem_1fr] lg:gap-16">
        <div className="grid h-fit gap-6">
          <section aria-labelledby="details-title" className="rounded-2xl border border-line bg-surface p-6">
            <h2 id="details-title" className="text-xl font-extrabold">
              {siteConfig.name}
            </h2>
            <address className="mt-5 grid gap-4 not-italic">
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
                <span>
                  {location.streetAddress ? <>{location.streetAddress}<br /></> : null}
                  {location.locality}, {location.region}, {location.country}
                  {location.postalCode ? ` – ${location.postalCode}` : ""}
                </span>
              </p>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-muted">Phone / WhatsApp</p>
                  <a href={`tel:${contact.phoneE164}`} className="text-lg font-bold text-brand-800 hover:underline">
                    {contact.phoneDisplay}
                  </a>
                </div>
              </div>
              {contact.email && (
                <p className="flex items-center gap-3">
                  <Mail className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <a href={`mailto:${contact.email}`} className="font-semibold text-brand-800 hover:underline">
                    {contact.email}
                  </a>
                </p>
              )}
              {contact.businessHours && (
                <p className="flex items-center gap-3">
                  <Clock className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  {contact.businessHours}
                </p>
              )}
            </address>
            <div className="mt-6 grid gap-3">
              <ExternalButtonLink href={buildWhatsAppUrl(whatsAppMessages.general)} variant="whatsapp" size="lg" className="w-full">
                <WhatsAppIcon className="size-5" />
                WhatsApp Us
              </ExternalButtonLink>
              <ExternalButtonLink href={`tel:${contact.phoneE164}`} variant="secondary" size="lg" className="w-full">
                <Phone className="size-4" aria-hidden="true" />
                Call {contact.phoneDisplay}
              </ExternalButtonLink>
            </div>
          </section>

          <section aria-labelledby="bulk-title" className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
            <h2 id="bulk-title" className="text-lg font-extrabold">
              Planning a bulk order?
            </h2>
            <p className="mt-2 text-muted">Use our quote form to list products and quantities in one go.</p>
            <ButtonLink href="/request-quote" className="mt-4 w-full">
              Request Bulk Quote
            </ButtonLink>
          </section>
        </div>

        <section aria-labelledby="form-title">
          <h2 id="form-title" className="text-2xl font-extrabold sm:text-3xl">
            Send us a message
          </h2>
          <p className="mb-8 mt-3 text-lg text-muted">Tell us what you need and we will get back to you.</p>
          <ContactForm />
        </section>
      </Container>
    </>
  );
}
