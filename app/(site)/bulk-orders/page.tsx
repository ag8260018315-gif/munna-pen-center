import { Check } from "lucide-react";
import { ContactAside } from "@/components/forms/contact-aside";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { JsonLd } from "@/components/seo/json-ld";
import { ExternalButtonLink } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/ui/section";
import { audiences } from "@/content/home";
import { siteConfig } from "@/lib/config/site";
import { pageMetadata } from "@/lib/seo";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

export const metadata = pageMetadata({
  title: "Bulk Stationery Orders – Wholesale Supplier for India",
  description:
    "Need stationery in bulk? Schools, offices, businesses, engineers, institutions and retailers can submit requirements to Munna Pen Center, Dhanbad, and receive a wholesale quotation.",
  path: "/bulk-orders",
});

const tips = [
  "The products you need — with sizes, colours or brands if you have a preference",
  "Approximate quantities for each product",
  "Your city and state, so we can plan delivery",
  "Whether this is a one-time order or a regular requirement",
];

const faqs = [
  {
    question: "Who can send a bulk enquiry?",
    answer: "Schools, offices, businesses, engineers, institutions and retailers can all submit a requirement. Tell us what you need and we will respond.",
  },
  {
    question: "Are prices shown on the website?",
    answer: "No. Wholesale pricing depends on your requirement, so we share prices as a quotation after you send an enquiry.",
  },
  {
    question: "Do you deliver across India?",
    answer: "Yes — we serve customers across India. Delivery details are confirmed when we respond to your enquiry.",
  },
  {
    question: "What should I include in my enquiry?",
    answer: "The products you need, approximate quantities, your city and state, and any brand, size or colour preferences. The more detail you share, the easier it is for us to respond.",
  },
  {
    question: "Can I enquire on WhatsApp instead of using the form?",
    answer: `Yes. Message us on WhatsApp on ${siteConfig.contact.phoneDisplay} and share the same details.`,
  },
  {
    question: "Are you GST registered?",
    answer: "Yes, Munna Pen Center is GST registered.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function BulkOrdersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bulk orders"
        title="Need Stationery in Bulk?"
        description="Schools, offices, businesses, engineers, institutions and retailers can submit their stationery and office-supply requirements to Munna Pen Center. Tell us what you need and we will respond with a wholesale quotation."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExternalButtonLink href={buildWhatsAppUrl(whatsAppMessages.bulkOrder)} variant="whatsapp" size="lg">
            <WhatsAppIcon className="size-5" />
            WhatsApp Us
          </ExternalButtonLink>
          <ul className="flex flex-wrap items-center gap-2" aria-label="Who can enquire">
            {audiences.items.map((item) => (
              <li key={item.name} className="rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-800">
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      </PageHeader>

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <section id="enquiry-form" aria-labelledby="form-title" className="scroll-mt-28">
          <h2 id="form-title" className="text-2xl font-extrabold sm:text-3xl">
            Bulk enquiry form
          </h2>
          <p className="mb-8 mt-3 text-lg text-muted">Fill in your requirement below. Fields marked * are required.</p>
          <EnquiryForm kind="bulk-order" />
        </section>

        <div className="grid h-fit gap-6 lg:sticky lg:top-28">
          <section aria-labelledby="tips-title" className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <h2 id="tips-title" className="text-lg font-extrabold">
              What to include
            </h2>
            <ul className="mt-4 grid gap-3.5">
              {tips.map((tip) => (
                <li key={tip} className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-muted">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </section>
          <ContactAside whatsappMessage={whatsAppMessages.bulkOrder} />
        </div>
      </Container>

      <section aria-labelledby="faq-title" className="border-t border-line bg-surface py-14 sm:py-20">
        <Container className="max-w-4xl">
          <h2 id="faq-title" className="text-3xl font-extrabold">
            Bulk order questions
          </h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
            {faqs.map((faq) => (
              <details key={faq.question} className="group p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-brand-950 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
      <JsonLd data={faqJsonLd} />
    </>
  );
}
