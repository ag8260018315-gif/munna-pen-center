import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/products/category-icon";
import { ButtonLink } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/ui/section";
import type { Category } from "@/lib/domain/types";

export function CategoriesGrid({ categories }: { categories: Category[] }) {
  return (
    <Section labelledBy="categories-title">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading
          id="categories-title"
          eyebrow="Product categories"
          title="Stationery and office supplies for your organisation"
          description="Browse our wholesale stationery and office supply categories, or tell us what you need and we will confirm availability."
        />
        <ButtonLink href="/products" variant="secondary" className="self-start sm:self-auto">
          View all products
          <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      </div>

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {categories.map((category) => (
          <li key={category.id} className="reveal">
            <Link
              href={`/categories/${category.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-800 group-hover:text-white">
                <CategoryIcon slug={category.slug} className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold leading-snug">{category.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{category.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                View products
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
