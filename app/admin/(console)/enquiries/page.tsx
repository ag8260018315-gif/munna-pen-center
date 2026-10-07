import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { listEnquiries } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Enquiries" };

const when = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d);

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Enquiries" /><DatabaseRequired /></div>;
  const { items, total, page, pages } = await listEnquiries({ status: sp.status, page: Number(sp.page) || 1 });
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title="Enquiries" intro="Everything customers send through the website forms. Newest first." />
      <form method="get" aria-label="Filter enquiries" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            {["NEW", "IN_REVIEW", "QUOTED", "WON", "LOST", "SPAM"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Filter</button>
      </form>
      {items.length === 0 ? (
        <Notice kind="info">{total === 0 ? "No enquiries yet." : "No enquiries match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Enquiries ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Reference</th>
                <th scope="col" className={tableClasses.th}>From</th>
                <th scope="col" className={tableClasses.th}>Phone</th>
                <th scope="col" className={tableClasses.th}>Received</th>
                <th scope="col" className={tableClasses.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/enquiries/${e.id}`} className="text-brand-800 hover:underline">{e.reference}</Link></th>
                  <td className={tableClasses.td}>{e.lead.name}{e.lead.organizationName ? ` · ${e.lead.organizationName}` : ""}</td>
                  <td className={tableClasses.td}>{e.lead.phone}</td>
                  <td className={tableClasses.td}>{when(e.createdAt)}</td>
                  <td className={tableClasses.td}><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/enquiries" params={{ status: sp.status }} />
    </div>
  );
}
