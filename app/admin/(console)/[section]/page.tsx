import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import { ADMIN_SECTIONS, getAdminSection } from "@/lib/admin/sections";

type Params = Promise<{ section: string }>;

export function generateStaticParams() {
  return ADMIN_SECTIONS.filter((section) => section.slug !== "dashboard").map((section) => ({ section: section.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const section = getAdminSection((await params).section);
  return { title: section?.label ?? "Admin" };
}

const PHASE_LABEL = {
  2: "Phase 2 — database and admin sign-in",
  3: "Phase 3 — AI sales agent and WhatsApp",
  4: "Phase 4 — orders, GST invoicing and payments",
} as const;

export default async function AdminSectionPage({ params }: { params: Params }) {
  await requireAdmin();
  const section = getAdminSection((await params).section);
  if (!section || section.slug === "dashboard") notFound();

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold">{section.label}</h1>
        <p className="mt-2 text-lg text-muted">{section.summary}</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">Not built yet</p>
        <dl className="mt-5 grid gap-5">
          <div>
            <dt className="text-sm font-semibold text-muted">Planned for</dt>
            <dd className="mt-1 font-semibold">{PHASE_LABEL[section.phase]}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-muted">Data it will manage</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {section.entities.map((entity) => (
                <code key={entity} className="rounded bg-brand-50 px-2 py-0.5 text-sm text-brand-800">
                  {entity}
                </code>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-muted">Needs first</dt>
            <dd className="mt-1">
              <ul className="list-disc pl-5">
                {section.requires.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
