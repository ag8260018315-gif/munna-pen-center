import { MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ExternalButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

/** "Prefer to talk?" card shown beside the forms. */
export function ContactAside({ whatsappMessage = whatsAppMessages.general }: { whatsappMessage?: string }) {
  const { contact, location } = siteConfig;
  return (
    <aside aria-labelledby="aside-title" className="grid h-fit gap-5 rounded-2xl border border-line bg-surface p-6">
      <h2 id="aside-title" className="text-lg font-extrabold">
        Prefer to talk?
      </h2>
      <p className="-mt-2 text-muted">Reach us directly on the number below.</p>
      <p className="flex items-center gap-3 font-semibold">
        <Phone className="size-5 text-brand-500" aria-hidden="true" />
        <a href={`tel:${contact.phoneE164}`} className="text-brand-800 hover:underline">
          {contact.phoneDisplay}
        </a>
      </p>
      <p className="flex items-start gap-3 text-ink">
        <MapPin className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
        <span>
          {siteConfig.name}
          <br />
          {location.locality}, {location.region}, {location.country}
        </span>
      </p>
      <ExternalButtonLink href={buildWhatsAppUrl(whatsappMessage)} variant="whatsapp" size="lg" className="w-full">
        <WhatsAppIcon className="size-5" />
        WhatsApp Us
      </ExternalButtonLink>
    </aside>
  );
}
