import { Info, Package, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { AddToEnquiryButton } from "@/components/products/add-to-enquiry-button";
import { ProductGrid } from "@/components/products/product-card";
import { ProductImage } from "@/components/products/product-image";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";
import { buildWhatsAppUrl, whatsAppMessages } from "@/lib/whatsapp";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const products = await getCatalogue().listAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getCatalogue().getProductBySlug((await params).slug);
  if (!product) return {};
  return pageMetadata({
    title: `${product.name} – Wholesale Supply`,
    description: `${product.shortDescription} Wholesale ${product.name.toLowerCase()} from Munna Pen Center, Dhanbad, Jharkhand — supplied across India. Request a wholesale quote.`,
    path: `/products/${product.slug}`,
  });
}

export default async function ProductPage({ params }: { params: Params }) {
  const catalogue = getCatalogue();
  const product = await catalogue.getProductBySlug((await params).slug);
  if (!product) notFound();

  const related = await catalogue.listRelatedProducts(product, 3);

  return (
    <>
      <div className="border-b border-line bg-brand-50">
        <Container className="pt-8 sm:pt-10">
          <Breadcrumbs
            trail={[
              { name: "Home", path: "/" },
              { name: "Products", path: "/products" },
              { name: product.category.name, path: `/categories/${product.category.slug}` },
              { name: product.name, path: `/products/${product.slug}` },
            ]}
          />
        </Container>
      </div>

      <Container className="py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ProductImage
            product={product}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-square w-full rounded-3xl border border-line"
          />

          <div>
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-sm font-bold uppercase tracking-[0.14em] text-brand-600 hover:underline"
            >
              {product.category.name}
            </Link>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">{product.name}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">{product.shortDescription}</p>

            <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
              <div className="p-4">
                <dt className="flex items-center gap-3 text-sm font-semibold text-muted">
                  <Package className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  Pack / unit
                </dt>
                <dd className="mt-1 pl-8 font-semibold">{product.packInfo ?? "Pack sizes confirmed on quotation"}</dd>
              </div>
              <div className="p-4">
                <dt className="flex items-center gap-3 text-sm font-semibold text-muted">
                  <Tag className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  Wholesale price
                </dt>
                <dd className="mt-1 pl-8 font-semibold">Get Wholesale Price — shared as a quotation</dd>
              </div>
              <div className="p-4">
                <dt className="flex items-center gap-3 text-sm font-semibold text-muted">
                  <Info className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                  Availability, brands & delivery
                </dt>
                <dd className="mt-1 pl-8 font-semibold">Confirmed when you send an enquiry</dd>
              </div>
            </dl>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/request-quote?product=${encodeURIComponent(product.slug)}`} size="lg" className="sm:col-span-2">
                Request Wholesale Quote
              </ButtonLink>
              <ExternalButtonLink href={buildWhatsAppUrl(whatsAppMessages.product(product.name))} variant="whatsapp" size="lg">
                <WhatsAppIcon className="size-5" />
                Ask on WhatsApp
              </ExternalButtonLink>
              <AddToEnquiryButton slug={product.slug} name={product.name} size="lg" />
            </div>

            <p className="mt-5 text-sm leading-relaxed text-muted">
              Need several products? Use <strong className="text-ink">Add to Enquiry</strong> on each one, then send a single request for all of them.
            </p>
          </div>
        </div>
      </Container>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-line bg-surface py-14 sm:py-16">
          <Container>
            <h2 id="related-title" className="mb-8 text-2xl font-extrabold sm:text-3xl">
              More in {product.category.name}
            </h2>
            <ProductGrid products={related} />
          </Container>
        </section>
      )}
    </>
  );
}
