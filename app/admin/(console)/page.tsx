import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ADMIN_ICONS } from "@/components/admin/admin-icons";
import { AGENT_ACTION_POLICY, SALES_STAGES } from "@/lib/ai-sales";
import { ADMIN_SECTIONS, adminHref } from "@/lib/admin/sections";
import { DatabaseRequired } from "@/components/admin/ui";
import { getDashboardCounts } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { cn } from "@/lib/cn";

const ACTOR_LABEL = { CUSTOMER: "Customer", AI_AGENT: "AI agent", OWNER: "Owner", SYSTEM: "System" } as const;

const approvalActions = Object.entries(AGENT_ACTION_POLICY)
  .filter(([, policy]) => policy === "OWNER_APPROVAL")
  .map(([action]) => action.toLowerCase().replace(/_/g, " "));

export default async function AdminDashboardPage() {
  await requireAdmin();
  const counts = isDatabaseConfigured() ? await getDashboardCounts() : null;
  const tiles = counts
    ? [
        { label: "New enquiries", value: counts.newEnquiries, href: "/admin/enquiries?status=NEW" },
        { label: "All enquiries", value: counts.enquiries, href: "/admin/enquiries" },
        { label: "Active products", value: counts.activeProducts, href: "/admin/products?status=ACTIVE" },
        { label: "Draft products", value: counts.draftProducts, href: "/admin/products?status=DRAFT" },
        { label: "Out of stock", value: counts.outOfStock, href: "/admin/inventory" },
        { label: "Brands", value: counts.brands, href: "/admin/brands" },
        { label: "Categories", value: counts.categories, href: "/admin/categories" },
      ]
    : [];

  return (
    <div className="mx-auto grid max-w-6xl gap-10">
      <div>
        <h1 className="text-3xl font-extrabold">Admin dashboard</h1>
        <p className="mt-2 max-w-3xl text-muted">Enquiries, products, brands, categories and stock are live. Quotations, orders, invoices and payments come next.</p>
      </div>

      {counts ? (
        <section aria-labelledby="counts-title">
          <h2 id="counts-title" className="text-xl font-extrabold">At a glance</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className="block rounded-xl border border-line bg-white p-4 hover:border-brand-400">
                  <span className="block text-3xl font-extrabold">{t.value}</span>
                  <span className="text-sm font-semibold text-muted">{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <DatabaseRequired />
      )}

      <section aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className="text-xl font-extrabold">
          Sales pipeline
        </h2>
        <p className="mt-1 text-sm text-muted">The path every enquiry will follow. Stages marked “Owner approval” cannot happen without the owner.</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SALES_STAGES.map((stage, index) => (
            <li key={stage.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-800 text-sm font-bold text-white">{index + 1}</span>
              <div className="min-w-0">
                <p className="font-bold leading-snug">{stage.label}</p>
                <p className="mt-1 text-xs text-muted">
                  {ACTOR_LABEL[stage.actor]} · {stage.entity}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.7rem] font-bold",
                      stage.implemented ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {stage.implemented ? "Live" : "Planned"}
                  </span>
                  {stage.requiresOwnerApproval && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[0.7rem] font-bold text-accent-700">
                      <ShieldCheck className="size-3" aria-hidden="true" /> Owner approval
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="approval-title" className="rounded-2xl border border-accent-200 bg-accent-50 p-6">
        <h2 id="approval-title" className="flex items-center gap-2 text-xl font-extrabold">
          <ShieldCheck className="size-5 text-accent-700" aria-hidden="true" />
          The owner stays in control
        </h2>
        <p className="mt-2 max-w-3xl text-ink/80">
          The AI sales agent may search the catalogue, ask questions and prepare quotation drafts. Every commercial commitment needs the owner&apos;s approval first, and
          moving money is never delegated to the agent.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {approvalActions.map((action) => (
            <li key={action} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold capitalize text-brand-900 shadow-sm">
              <Check className="size-3.5 text-accent-700" aria-hidden="true" />
              {action}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sections-title">
        <h2 id="sections-title" className="text-xl font-extrabold">
          Dashboard sections
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_SECTIONS.filter((section) => section.slug !== "dashboard").map((section) => {
            const Icon = ADMIN_ICONS[section.icon];
            return (
              <li key={section.slug}>
                <Link href={adminHref(section)} className="flex h-full gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-brand-300">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-bold">{section.label}</span>
                    <span className="mt-0.5 block text-sm text-muted">Planned · Phase {section.phase}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
