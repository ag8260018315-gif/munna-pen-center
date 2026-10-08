import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listQuotations } from "@/lib/admin/quotation-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";

export const metadata: Metadata = { title: "Quotations" };

const when = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(d);
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Quotations" /><DatabaseRequired /></div>;
  const { items, total, page, pages } = await listQuotations({ status: sp.status, page: Number(sp.page) || 1 });
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title="Quotations" intro="Start from an enquiry (open it and press “Create quotation”) or create one for an existing customer." actions={<ButtonLink href="/admin/quotes/new">New quotation</ButtonLink>} />
      <form method="get" aria-label="Filter quotations" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Filter</button>
      </form>
      {items.length === 0 ? (
        <Notice kind="info">{total === 0 ? "No quotations yet." : "No quotations match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Quotations ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Number</th>
                <th scope="col" className={tableClasses.th}>Customer</th>
                <th scope="col" className={tableClasses.th}>Lines</th>
                <th scope="col" className={tableClasses.th}>Total (incl. GST)</th>
                <th scope="col" className={tableClasses.th}>Created</th>
                <th scope="col" className={tableClasses.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/quotes/${q.id}`} className="text-brand-800 hover:underline">{q.number}</Link></th>
                  <td className={tableClasses.td}>{q.customer.organizationName}</td>
                  <td className={tableClasses.td}>{q._count.items}</td>
                  <td className={tableClasses.td}>{q.total ? formatRupees(q.total.toString()) : <span className="text-muted">not priced</span>}</td>
                  <td className={tableClasses.td}>{when(q.createdAt)}</td>
                  <td className={tableClasses.td}><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/quotes" params={{ status: sp.status }} />
    </div>
  );
}
