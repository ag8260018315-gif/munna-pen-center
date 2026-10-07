import { Check, MapPin } from "lucide-react";
import { HeroIllustration } from "@/components/illustrations/hero-illustration";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { hero } from "@/content/home";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-white">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden="true" />
      <Container className="relative grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-24">
        <div>
          <p
            className="enter inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-800"
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            <MapPin className="size-4 text-brand-600" aria-hidden="true" />
            {hero.eyebrow}
          </p>

          <h1
            id="hero-title"
            className="enter mt-6 text-[2.25rem] font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.5rem]"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            {hero.headline}
          </h1>

          <p className="enter mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ "--delay": "160ms" } as React.CSSProperties}>
            {hero.description}
          </p>

          <div className="enter mt-8 flex flex-col gap-3 sm:flex-row" style={{ "--delay": "240ms" } as React.CSSProperties}>
            <ButtonLink href="/request-quote" size="lg">
              {hero.primaryCta}
            </ButtonLink>
            <ButtonLink href="/products" variant="secondary" size="lg">
              {hero.secondaryCta}
            </ButtonLink>
          </div>

          <p className="enter mt-4 text-sm text-muted" style={{ "--delay": "300ms" } as React.CSSProperties}>
            Prefer to talk?{" "}
            <a
              href={buildWhatsAppUrl(whatsAppMessages.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-whatsapp underline underline-offset-4 hover:text-whatsapp-dark"
            >
              <WhatsAppIcon className="size-4" />
              WhatsApp us
            </a>
          </p>

          <ul className="enter mt-10 grid gap-3 border-t border-line pt-8 sm:grid-cols-2" style={{ "--delay": "360ms" } as React.CSSProperties}>
            {hero.trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-3 font-semibold text-brand-900">
                <span className="grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="enter relative mx-auto w-full max-w-xl lg:max-w-none" style={{ "--delay": "200ms" } as React.CSSProperties}>
          <HeroIllustration className="h-auto w-full drop-shadow-[0_24px_40px_rgb(38_47_98/0.18)]" />
        </div>
      </Container>
    </section>
  );
}
