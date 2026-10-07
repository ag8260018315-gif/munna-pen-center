import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

/** Closing call-to-action: the two things we want every visitor to do. */
export function CtaBand({
  title = "Need stationery in bulk?",
  description = "Send us your requirement and we will respond with a wholesale quotation.",
  whatsappMessage = whatsAppMessages.bulkOrder,
}: {
  title?: string;
  description?: string;
  whatsappMessage?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="on-dark bg-brand-900">
      <Container className="py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-12 text-center sm:px-12">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative">
            <h2 id="cta-title" className="text-3xl font-extrabold text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-100">{description}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/request-quote" size="lg">
                Request Bulk Quote
              </ButtonLink>
              <ExternalButtonLink href={buildWhatsAppUrl(whatsappMessage)} variant="whatsapp" size="lg">
                <WhatsAppIcon className="size-5" />
                WhatsApp Us
              </ExternalButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
