import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "success" | "error" | "info"; children: ReactNode }) {
  const style = {
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    error: "border-red-300 bg-red-50 text-red-800",
    info: "border-sky-300 bg-sky-50 text-sky-900",
  }[kind];
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm font-medium", style)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Shown instead of data screens when no database is connected (local preview). */
export function DatabaseRequired() {
  return (
    <Notice kind="info">
      The database is not connected, so there is nothing to manage yet. Connect it as described in docs/SUPABASE_SETUP.md, then sign in.
    </Notice>
  );
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DRAFT: "bg-slate-100 text-slate-700",
  INACTIVE: "bg-amber-100 text-amber-900",
  NEW: "bg-sky-100 text-sky-900",
  IN_REVIEW: "bg-violet-100 text-violet-900",
  QUOTED: "bg-indigo-100 text-indigo-900",
  WON: "bg-emerald-100 text-emerald-800",
  LOST: "bg-slate-100 text-slate-700",
  SPAM: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700")}>{status.replace("_", " ")}</span>;
}

export function YesNo({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return <span className={value ? "font-semibold text-emerald-800" : "text-muted"}>{value ? yes : no}</span>;
}

export function Pagination({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params?: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
    if (n > 1) q.set("page", String(n));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const link = "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={link}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export const tableClasses = {
  wrap: "overflow-x-auto rounded-xl border border-line bg-white",
  table: "w-full min-w-[40rem] text-left text-sm",
  th: "bg-slate-50 px-4 py-3 font-bold text-ink",
  td: "border-t border-line px-4 py-3 align-top",
};
