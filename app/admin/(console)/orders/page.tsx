import type { Metadata } from "next";
import Link from "next/link";
import { createOrderAction } from "@/app/actions/admin-billing";
import { ActionButton } from "@/components/admin/billing-forms";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { listOrders, listQuotationsAwaitingOrder, ORDER_STATUSES } from "@/lib/admin/order-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";

export const metadata: Metadata = { title: "Orders" };

const when = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(d);
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Orders" /><DatabaseRequired /></div>;
  const [{ items, total, page, pages }, waiting] = await Promise.all([listOrders({ status: sp.status, q: sp.q, page: Number(sp.page) || 1 }), listQuotationsAwaitingOrder()]);
  return (
    <div className="mx-auto grid max-w-6xl gap-8">
      <PageHeader title="Orders" intro="An order starts from a quotation the customer accepted. The owner confirms it; then it is processed, dispatched and delivered." />

      {waiting.length > 0 && (
        <section aria-labelledby="waiting" className="grid gap-3 rounded-xl border border-line bg-white p-5">
          <h2 id="waiting" className="text-lg font-extrabold">Accepted quotations without an order</h2>
          <ul className="grid gap-3">
            {waiting.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span>
                  <Link href={`/admin/quotes/${q.id}`} className="font-semibold text-brand-800 hover:underline">{q.number}</Link> · {q.customer.organizationName}
                  {q.total && <> · {formatRupees(q.total.toString())}</>}
                </span>
                <ActionButton action={createOrderAction.bind(null, q.id)} label="Create order" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <form method="get" aria-label="Filter orders" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">Order or customer</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} maxLength={80} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Filter</button>
      </form>

      {items.length === 0 ? (
        <Notice kind="info">{total === 0 && !sp.status && !sp.q ? "No orders yet. Orders appear here once an accepted quotation is turned into one." : "No orders match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Orders ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Order</th>
                <th scope="col" className={tableClasses.th}>Customer</th>
                <th scope="col" className={tableClasses.th}>Lines</th>
                <th scope="col" className={tableClasses.th}>Total (incl. GST)</th>
                <th scope="col" className={tableClasses.th}>Created</th>
                <th scope="col" className={tableClasses.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/orders/${o.id}`} className="text-brand-800 hover:underline">{o.number}</Link></th>
                  <td className={tableClasses.td}>{o.customer.organizationName}</td>
                  <td className={tableClasses.td}>{o._count.items}</td>
                  <td className={tableClasses.td}>{formatRupees(o.total.toString())}</td>
                  <td className={tableClasses.td}>{when(o.createdAt)}</td>
                  <td className={tableClasses.td}><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/orders" params={{ status: sp.status, q: sp.q }} />
    </div>
  );
}
