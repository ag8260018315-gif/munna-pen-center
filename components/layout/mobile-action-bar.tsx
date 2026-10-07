import { FileText, Phone } from "lucide-react";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { siteConfig } from "@/lib/config/site";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

/**
 * Sticky contact bar for phones: one tap to call, WhatsApp, or request a quote.
 * Hidden from the `md` breakpoint up, where the header CTAs are always visible.
 */
export function MobileActionBar() {
  const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold leading-tight";
  return (
    <div
      role="region"
      aria-label="Quick contact actions"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-[0_-4px_20px_rgb(22_27_59/0.1)] md:hidden"
    >
      <div className="flex">
        <a href={`tel:${siteConfig.contact.phoneE164}`} className={`${item} text-brand-800`}>
          <Phone className="size-5" aria-hidden="true" />
          Call
        </a>
        <a
          href={buildWhatsAppUrl(whatsAppMessages.general)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${item} bg-whatsapp text-white`}
        >
          <WhatsAppIcon className="size-5" />
          WhatsApp
        </a>
        <Link href="/request-quote" className={`${item} bg-accent-500 text-brand-950`}>
          <FileText className="size-5" aria-hidden="true" />
          Get Quote
        </Link>
      </div>
    </div>
  );
}
