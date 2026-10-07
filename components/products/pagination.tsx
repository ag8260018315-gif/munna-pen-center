import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export function Pagination({ page, totalPages, basePath, params }: { page: number; totalPages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass = "inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50";

  return (
    <nav aria-label="Pagination" className="mt-10 grid grid-cols-3 items-center gap-4">
      <div className="justify-self-start">
        {page > 1 && (
          <Link href={href(page - 1)} rel="prev" className={linkClass}>
            <ChevronLeft className="size-4" aria-hidden="true" /> Previous
          </Link>
        )}
      </div>
      <p className="text-center text-sm text-muted">
        Page <strong className="text-ink">{page}</strong> of {totalPages}
      </p>
      <div className="justify-self-end">
        {page < totalPages && (
          <Link href={href(page + 1)} rel="next" className={linkClass}>
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  );
}
