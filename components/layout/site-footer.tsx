import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Container } from "@/components/ui/section";
import { primaryNav, quoteNav } from "@/lib/config/navigation";
import { siteConfig } from "@/lib/config/site";
import { getCatalogue } from "@/lib/repositories";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

const linkClass = "text-brand-100 transition-colors hover:text-white";

export async function SiteFooter() {
  const categories = await getCatalogue().listCategories();
  const { contact, location, gst } = siteConfig;

  return (
    <footer className="on-dark bg-brand-950 pb-24 text-brand-100 md:pb-0">
      <Container className="grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo tone="dark" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-200">
            Wholesale stationery and office supplies for schools, offices, engineers, businesses, institutions and retailers across India.
          </p>
          {gst.registered && (
            <p className="mt-4 inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-brand-100">
              GST Registered
            </p>
          )}
        </div>

        <nav aria-label="Product categories">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Products</h2>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {categories.slice(0, 8).map((category) => (
              <li key={category.id}>
                <Link href={`/categories/${category.slug}`} className={linkClass}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Company</h2>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {[...primaryNav, quoteNav].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Contact</h2>
          <address className="mt-4 grid gap-3 text-sm not-italic">
            <p className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
              <span>
                {siteConfig.name}
                <br />
                {location.streetAddress ? <>{location.streetAddress}<br /></> : null}
                {location.locality}, {location.region}, {location.country}
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden="true" />
              <span className="grid gap-1.5">
                <a href={`tel:${contact.phoneE164}`} className={linkClass}>
                  {contact.phoneDisplay}
                </a>
                {contact.additionalPhones.map((phone) => (
                  <a key={phone.e164} href={`tel:${phone.e164}`} className={linkClass}>
                    {phone.display}
                  </a>
                ))}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <WhatsAppIcon className="size-4 shrink-0 text-accent-300" />
              <a href={buildWhatsAppUrl(whatsAppMessages.general)} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Chat on WhatsApp
              </a>
            </p>
            {contact.email && (
              <p>
                <a href={`mailto:${contact.email}`} className={linkClass}>
                  {contact.email}
                </a>
              </p>
            )}
          </address>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p>Wholesale supply across India · Prices on request</p>
        </Container>
      </div>
    </footer>
  );
}
