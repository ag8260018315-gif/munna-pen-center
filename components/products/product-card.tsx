import { Package, Tag } from "lucide-react";
import Link from "next/link";
import { AddToEnquiryButton } from "@/components/products/add-to-enquiry-button";
import { ProductImage } from "@/components/products/product-image";
import { ButtonLink } from "@/components/ui/button";
import type { ProductWithCategory } from "@/lib/domain/types";

/**
 * Catalogue card. Wholesale pricing is quoted, never shown: the price slot says
 * "Get Wholesale Price". Pack / unit information appears only when it is known.
 */
export function ProductCard({ product, headingLevel = 3 }: { product: ProductWithCategory; headingLevel?: 2 | 3 }) {
  const href = `/products/${product.slug}`;
  const Heading = `h${headingLevel}` as const;
  return (
    <article className="@container group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
        <ProductImage product={product} className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.02]" />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">{product.category.name}</p>
        <Heading className="mt-1.5 text-lg font-bold leading-snug">
          <Link href={href} className="hover:text-brand-700 hover:underline">
            {product.name}
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{product.shortDescription}</p>

        <dl className="mt-4 grid gap-2 text-sm">
          <div>
            <dt className="sr-only">Pack / unit</dt>
            <dd className="flex items-center gap-2">
              <Package className="size-4 shrink-0 text-brand-400" aria-hidden="true" />
              {product.packInfo ?? <span className="text-muted">Pack sizes on request</span>}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Price</dt>
            <dd className="flex items-center gap-2">
              <Tag className="size-4 shrink-0 text-brand-400" aria-hidden="true" />
              <Link href={href} className="font-semibold text-brand-700 hover:underline">
                Get Wholesale Price
              </Link>
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2.5 pt-5 @[22rem]:flex-row">
          <ButtonLink href={`/request-quote?product=${encodeURIComponent(product.slug)}`} size="sm" className="@[22rem]:flex-1">
            Request Quote
          </ButtonLink>
          <AddToEnquiryButton slug={product.slug} name={product.name} size="sm" className="@[22rem]:flex-1" />
        </div>
      </div>
    </article>
  );
}

/** `headingLevel`: use 2 when the grid follows the page <h1> directly, 3 when it sits under an <h2>. */
export function ProductGrid({ products, headingLevel = 3 }: { products: ProductWithCategory[]; headingLevel?: 2 | 3 }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
