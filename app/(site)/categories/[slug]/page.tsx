import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/home/cta-band";
import { CategoryIcon } from "@/components/products/category-icon";
import { ProductGrid } from "@/components/products/product-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { EmptyState } from "@/components/ui/state-panels";
import { Container } from "@/components/ui/section";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const categories = await getCatalogue().listCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await getCatalogue().getCategoryBySlug((await params).slug);
  if (!category) return {};
  // A category with nothing listed yet is a thin page: keep it out of search results until products are added.
  const { total } = await getCatalogue().searchProducts({ categorySlug: category.slug, pageSize: 1 });
  return pageMetadata({ title: category.seoTitle, description: category.seoDescription, path: `/categories/${category.slug}`, noIndex: total === 0 });
}

export default async function CategoryPage({ params }: { params: Params }) {
  const catalogue = getCatalogue();
  const category = await catalogue.getCategoryBySlug((await params).slug);
  if (!category) notFound();

  const [{ items }, categories] = await Promise.all([catalogue.searchProducts({ categorySlug: category.slug, pageSize: 60 }), catalogue.listCategories()]);

  return (
    <>
      <div className="relative overflow-hidden border-b border-line bg-brand-50">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <Container className="relative py-10 sm:py-14">
          <Breadcrumbs
            trail={[
              { name: "Home", path: "/" },
              { name: "Products", path: "/products" },
              { name: category.name, path: `/categories/${category.slug}` },
            ]}
          />
          <div className="flex items-start gap-5">
            <span className="hidden size-16 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-card sm:grid">
              <CategoryIcon slug={category.slug} className="size-8" />
            </span>
            <div>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{category.name}</h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{category.description}</p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-12 sm:py-16">
        <p className="mb-8 text-sm text-muted">Listings are indicative — availability, brands, pack sizes and prices are confirmed on enquiry.</p>
        {items.length > 0 ? (
          <ProductGrid products={items} headingLevel={2} />
        ) : (
          <EmptyState
            title={`${category.name}: tell us what you need`}
            actions={
              <>
                <ButtonLink href={`/request-quote?need=${encodeURIComponent(category.name)}`} size="lg">
                  Request a quote
                </ButtonLink>
                <ExternalButtonLink href={buildWhatsAppUrl(`Hello Munna Pen Center, I am looking for: ${category.name}.`)} variant="whatsapp" size="lg">
                  <WhatsAppIcon className="size-5" />
                  Ask on WhatsApp
                </ExternalButtonLink>
              </>
            }
          >
            We have not listed individual products in this category online yet. Tell us the type, brand and quantity you need and we will confirm
            availability and send a wholesale quotation.
          </EmptyState>
        )}

        <nav aria-label="Other categories" className="mt-16 border-t border-line pt-10">
          <h2 className="text-xl font-extrabold">Other categories</h2>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {categories
              .filter((other) => other.id !== category.id)
              .map((other) => (
                <li key={other.id}>
                  <Link
                    href={`/categories/${other.slug}`}
                    className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {other.name}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </Container>

      <CtaBand />
    </>
  );
}
