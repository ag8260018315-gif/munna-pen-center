import { AlertTriangle, SearchX } from "lucide-react";
import type { ReactNode } from "react";

/** Centred panel for empty results. */
export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-card">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-2xl font-extrabold">{title}</h2>
      {children && <div className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
    </div>
  );
}

/** Panel for failures. */
export function ErrorState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-red-700 shadow-card">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-red-950">{title}</h1>
      {children && <div className="mx-auto mt-3 max-w-xl leading-relaxed text-red-900">{children}</div>}
      {actions && <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
    </div>
  );
}
