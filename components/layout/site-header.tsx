import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Logo } from "@/components/brand/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLinks } from "@/components/layout/nav-links";
import { QuoteCta } from "@/components/layout/quote-cta";
import { ExternalButtonLink } from "@/components/ui/button";
import { primaryNav } from "@/lib/config/navigation";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

export function SiteHeader() {
  const whatsappUrl = buildWhatsAppUrl(whatsAppMessages.general);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="relative mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Munna Pen Center Wholesale Stationery, home" className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <NavLinks items={primaryNav} />
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ExternalButtonLink href={whatsappUrl} variant="secondary" size="sm" className="border-whatsapp/30 text-whatsapp hover:border-whatsapp hover:bg-whatsapp/5 max-xl:w-11 max-xl:px-0">
            <WhatsAppIcon className="size-4" />
            {/* Icon-only between 1024 and 1279px to keep the bar on one line; the text stays in the accessible name. */}
            <span className="max-xl:sr-only">WhatsApp Us</span>
          </ExternalButtonLink>
          <QuoteCta size="sm" />
        </div>

        <MobileMenu items={primaryNav} whatsappUrl={whatsappUrl} />
      </div>
    </header>
  );
}
