import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, Pagination, tableClasses } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listCustomers } from "@/lib/admin/customer-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { CUSTOMER_TYPE_LABEL } from "@/lib/validation/admin-sales";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-5xl gap-6"><PageHeader title="Customers" /><DatabaseRequired /></div>;
  const { items, total, page, pages } = await listCustomers({ q: sp.q, page: Number(sp.page) || 1 });
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Customers" intro="Organisations you quote and sell to. A customer is created automatically when you quote an enquiry." actions={<ButtonLink href="/admin/customers/new">Add customer</ButtonLink>} />
      {sp.saved && <Notice kind="success">Saved.</Notice>}
      <form method="get" role="search" aria-label="Search customers" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">Search</label>
          <input id="q" name="q" defaultValue={sp.q} maxLength={80} placeholder="Name or phone" className="h-11 w-64 max-w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Search</button>
      </form>
      {items.length === 0 ? (
        <Notice kind="info">{total === 0 && !sp.q ? "No customers yet." : "No customers match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Customers ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Customer</th>
                <th scope="col" className={tableClasses.th}>Contact</th>
                <th scope="col" className={tableClasses.th}>Phone</th>
                <th scope="col" className={tableClasses.th}>Type</th>
                <th scope="col" className={tableClasses.th}>Quotations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/customers/${c.id}`} className="text-brand-800 hover:underline">{c.organizationName}</Link></th>
                  <td className={tableClasses.td}>{c.contactName}</td>
                  <td className={tableClasses.td}>{c.phone}</td>
                  <td className={tableClasses.td}>{CUSTOMER_TYPE_LABEL[c.type]}</td>
                  <td className={tableClasses.td}>{c._count.quotations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/customers" params={{ q: sp.q }} />
    </div>
  );
}
