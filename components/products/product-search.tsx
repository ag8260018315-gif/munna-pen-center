import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Category } from "@/lib/domain/types";

/**
 * Product search + category filter.
 * A plain GET form and links: it works without JavaScript, the results are
 * rendered on the server, and every filtered view has a shareable URL.
 */
export function ProductSearch({ categories, query, categorySlug }: { categories: Category[]; query: string; categorySlug?: string }) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
      active ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50",
    );

  const href = (slug?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (slug) params.set("category", slug);
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="grid gap-5">
      <form action="/products" method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        <div className="relative flex-1">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand-400" aria-hidden="true" />
          <input
            id="product-search"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="Search products — e.g. gel pens, registers, calculators"
            autoComplete="off"
            className="h-13 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-base text-ink shadow-sm placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      <nav aria-label="Filter by category">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <li>
            <Link href={href()} aria-current={!categorySlug ? "true" : undefined} className={chip(!categorySlug)}>
              All products
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={href(category.slug)} aria-current={categorySlug === category.slug ? "true" : undefined} className={chip(categorySlug === category.slug)}>
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
