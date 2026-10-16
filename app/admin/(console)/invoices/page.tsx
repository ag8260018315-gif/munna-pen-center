import type { Metadata } from "next";
import Link from "next/link";
import { createInvoiceDraftAction } from "@/app/actions/admin-billing";
import { ActionButton } from "@/components/admin/billing-forms";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { INVOICE_STATUSES, listInvoices, listOrdersReadyToInvoice } from "@/lib/admin/invoice-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";

export const metadata: Metadata = { title: "Invoices" };

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(d) : "—");
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Invoices" /><DatabaseRequired /></div>;
  const [{ items, total, page, pages }, ready] = await Promise.all([listInvoices({ status: sp.status, q: sp.q, page: Number(sp.page) || 1 }), listOrdersReadyToInvoice()]);
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8">
      <PageHeader title="Invoices" intro="GST tax invoices are made from confirmed orders. Staff can prepare a draft; only the owner issues it." />

      {ready.length > 0 && (
        <section aria-labelledby="ready" className="grid gap-3 rounded-xl border border-line bg-white p-5">
          <h2 id="ready" className="text-lg font-extrabold">Orders without an invoice</h2>
          <ul className="grid gap-3">
            {ready.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-800 hover:underline">{o.number}</Link> · {o.customer.organizationName} · {formatRupees(o.total.toString())} · <StatusBadge status={o.status} />
                </span>
                <ActionButton action={createInvoiceDraftAction.bind(null, o.id)} label="Create draft invoice" variant="secondary" ariaLabel={`Create draft invoice for ${o.number}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <form method="get" aria-label="Filter invoices" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">Invoice, order or customer</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} maxLength={80} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Filter</button>
      </form>

      {items.length === 0 ? (
        <Notice kind="info">{total === 0 && !sp.status && !sp.q ? "No invoices yet." : "No invoices match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Invoices ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Invoice</th>
                <th scope="col" className={tableClasses.th}>Customer</th>
                <th scope="col" className={tableClasses.th}>Order</th>
                <th scope="col" className={tableClasses.th}>Date</th>
                <th scope="col" className={tableClasses.th}>Total</th>
                <th scope="col" className={tableClasses.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/invoices/${i.id}`} className="text-brand-800 hover:underline">{i.number ?? "Draft"}</Link></th>
                  <td className={tableClasses.td}>{i.customer.organizationName}</td>
                  <td className={tableClasses.td}>{i.order.number}</td>
                  <td className={tableClasses.td}>{i.issueDate ? when(i.issueDate) : <span className="text-muted">not issued</span>}</td>
                  <td className={tableClasses.td}>{i.number ? formatRupees(i.total.toString()) : <span className="text-muted">—</span>}</td>
                  <td className={tableClasses.td}><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/invoices" params={{ status: sp.status, q: sp.q }} />
    </div>
  );
}
