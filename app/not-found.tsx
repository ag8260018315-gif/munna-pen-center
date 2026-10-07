import { Compass } from "lucide-react";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="py-24 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Compass className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-brand-600">Error 404</p>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">We could not find that page</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">The page may have moved or the link may be wrong. Try our products, or tell us what you need.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/products" size="lg">
              Browse products
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="lg">
              Go to home page
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
      <MobileActionBar />
    </>
  );
}
