import { CheckCircle2 } from "lucide-react";
import { ContactAside } from "@/components/forms/contact-aside";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { Container, PageHeader } from "@/components/ui/section";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";
import { truncate } from "@/lib/text";
import { whatsAppMessages } from "@/lib/whatsapp";

export const metadata = pageMetadata({
  title: "Request a Wholesale Quote",
  description:
    "Request a wholesale quotation for stationery and office supplies from Munna Pen Center, Dhanbad. Choose products, share quantities and we will respond with availability and pricing.",
  path: "/request-quote",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const nextSteps = [
  "We review the products and quantities you share.",
  "We contact you on your phone / WhatsApp number with availability and wholesale pricing.",
  "You approve the quotation and we confirm your order.",
];

export default async function RequestQuotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const productSlug = first(params.product);
  const product = productSlug ? await getCatalogue().getProductBySlug(productSlug) : null;
  const need = truncate((first(params.need) ?? "").trim(), 200, "");

  return (
    <>
      <PageHeader
        eyebrow="Request Quote"
        title="Request a Wholesale Quote"
        description="Tell us what you need. Add products to your enquiry list, share approximate quantities and your city, and we will respond with availability and a wholesale quotation."
      />

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div id="enquiry-form" className="scroll-mt-28">
          <EnquiryForm kind="quote" preselect={product ? { slug: product.slug, name: product.name } : undefined} defaultProducts={need || undefined} />
        </div>

        <div className="grid h-fit gap-6 lg:sticky lg:top-28">
          <section aria-labelledby="next-title" className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <h2 id="next-title" className="text-lg font-extrabold">
              What happens next
            </h2>
            <ol className="mt-4 grid gap-3.5">
              {nextSteps.map((step) => (
                <li key={step} className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-muted">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ol>
          </section>
          <ContactAside whatsappMessage={whatsAppMessages.general} />
        </div>
      </Container>
    </>
  );
}
