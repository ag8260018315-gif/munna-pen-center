import type { Metadata } from "next";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Pagination } from "@/components/products/pagination";
import { ProductGrid } from "@/components/products/product-card";
import { ProductSearch } from "@/components/products/product-search";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/state-panels";
import { CtaBand } from "@/components/home/cta-band";
import { pageSeo } from "@/content/seo";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";
import { truncate } from "@/lib/text";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function readParams(searchParams: SearchParams) {
  const params = await searchParams;
  const catalogue = getCatalogue();
  const query = truncate((first(params.q) ?? "").trim(), 80, "");
  const categories = await catalogue.listCategories();
  const category = categories.find((c) => c.slug === first(params.category));
  const page = Math.max(1, parseInt(first(params.page) ?? "1", 10) || 1);
  return { catalogue, categories, query, category, page };
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { query, category, page } = await readParams(searchParams);
  const base = pageMetadata({ ...pageSeo.products, path: "/products" });
  // Search results and filtered views are for people, not search engines: keep them out of the index.
  if (query || page > 1) return { ...base, robots: { index: false, follow: true } };
  if (category) return { ...base, alternates: { canonical: `/categories/${category.slug}` }, robots: { index: false, follow: true } };
  return base;
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const { catalogue, categories, query, category, page } = await readParams(searchParams);
  const result = await catalogue.searchProducts({ query, categorySlug: category?.slug, page });
  const filtered = Boolean(query || category);

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Wholesale Stationery & Office Supplies"
        description="Browse by category or search for what you need. Wholesale prices are shared as a quotation — choose products, add them to your enquiry and request a quote."
      >
        <ProductSearch categories={categories} query={query} categorySlug={category?.slug} />
      </PageHeader>

      <Container className="py-12 sm:py-16">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
          <p aria-live="polite" className="text-muted">
            {result.total === 0 ? (
              "No products found"
            ) : (
              <>
                Showing <strong className="text-ink">{result.items.length}</strong> of <strong className="text-ink">{result.total}</strong> product
                {result.total === 1 ? "" : "s"}
                {category ? <> in <strong className="text-ink">{category.name}</strong></> : null}
                {query ? <> matching “<strong className="text-ink">{query}</strong>”</> : null}
              </>
            )}
          </p>
          <p className="text-sm text-muted">Listings are indicative — availability, brands, pack sizes and prices are confirmed on enquiry.</p>
        </div>

        {result.total === 0 ? (
          <EmptyState
            title={query ? `No products match “${query}”` : "No products in this category yet"}
            actions={
              <>
                <ButtonLink href={`/request-quote${query ? `?need=${encodeURIComponent(query)}` : ""}`} size="lg">
                  Tell us what you need
                </ButtonLink>
                <ExternalButtonLink
                  href={buildWhatsAppUrl(`Hello Munna Pen Center, I am looking for: ${query || "stationery products"}.`)}
                  variant="whatsapp"
                  size="lg"
                >
                  <WhatsAppIcon className="size-5" />
                  Ask on WhatsApp
                </ExternalButtonLink>
                {filtered && (
                  <ButtonLink href="/products" variant="secondary" size="lg">
                    Clear search
                  </ButtonLink>
                )}
              </>
            }
          >
            <p>Our catalogue is indicative — we may still be able to supply it. Send us your requirement and we will confirm availability.</p>
          </EmptyState>
        ) : (
          <>
            <ProductGrid products={result.items} headingLevel={2} />
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/products" params={{ q: query, category: category?.slug }} />
          </>
        )}
      </Container>

      <CtaBand title="Can't find what you need?" description="Tell us your requirement — we will confirm availability and share a wholesale quotation." />
    </>
  );
}
