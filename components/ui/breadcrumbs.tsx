import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail + BreadcrumbList structured data. The last crumb is the current page. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-semibold text-brand-900">
                    {crumb.name}
                  </span>
                ) : (
                  <Link href={crumb.path} className="hover:text-brand-700 hover:underline">
                    {crumb.name}
                  </Link>
                )}
                {!last && <ChevronRight className="size-3.5 text-brand-300" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </>
  );
}
