import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { listPayments, listReceivables } from "@/lib/admin/invoice-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";
import { PAYMENT_METHOD_LABEL } from "@/lib/validation/admin-sales";

export const metadata: Metadata = { title: "Payments" };

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(d) : "—");

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Payments" /><DatabaseRequired /></div>;
  const [receivables, { items, total, page, pages }] = await Promise.all([listReceivables(), listPayments({ page: Number(sp.page) || 1 })]);
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8">
      <PageHeader title="Payments" intro="Money received against invoices, and what is still owed. Payments are recorded from the invoice page, by a person, after the money has arrived." />

      <section aria-labelledby="owed" className="grid gap-3">
        <h2 id="owed" className="text-xl font-extrabold">Still owed</h2>
        {receivables.length === 0 ? (
          <Notice kind="info">No unpaid invoices.</Notice>
        ) : (
          <div className={tableClasses.wrap}>
            <table className={tableClasses.table}>
              <caption className="sr-only">Invoices that are not fully paid</caption>
              <thead>
                <tr>
                  <th scope="col" className={tableClasses.th}>Invoice</th>
                  <th scope="col" className={tableClasses.th}>Customer</th>
                  <th scope="col" className={tableClasses.th}>Due</th>
                  <th scope="col" className={tableClasses.th}>Total</th>
                  <th scope="col" className={tableClasses.th}>Received</th>
                  <th scope="col" className={tableClasses.th}>Still owed</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/invoices/${r.id}`} className="text-brand-800 hover:underline">{r.number}</Link></th>
                    <td className={tableClasses.td}>{r.customer.organizationName}</td>
                    <td className={tableClasses.td}>{r.dueDate ? when(r.dueDate) : <span className="text-muted">no due date</span>}{r.overdue && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Overdue</span>}</td>
                    <td className={tableClasses.td}>{formatRupees(r.total.toString())}</td>
                    <td className={tableClasses.td}>{formatRupees(r.paid)}</td>
                    <td className={`${tableClasses.td} font-semibold`}>{formatRupees(r.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="received" className="grid gap-3">
        <h2 id="received" className="text-xl font-extrabold">Payments recorded</h2>
        {items.length === 0 ? (
          <Notice kind="info">No payments recorded yet.</Notice>
        ) : (
          <div className={tableClasses.wrap}>
            <table className={tableClasses.table}>
              <caption className="sr-only">Payments ({total})</caption>
              <thead>
                <tr>
                  <th scope="col" className={tableClasses.th}>Date</th>
                  <th scope="col" className={tableClasses.th}>Invoice</th>
                  <th scope="col" className={tableClasses.th}>Customer</th>
                  <th scope="col" className={tableClasses.th}>Amount</th>
                  <th scope="col" className={tableClasses.th}>How</th>
                  <th scope="col" className={tableClasses.th}>Recorded by</th>
                  <th scope="col" className={tableClasses.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className={`${tableClasses.td} font-semibold`}>{when(p.paidAt)}</th>
                    <td className={tableClasses.td}><Link href={`/admin/invoices/${p.invoice.id}`} className="text-brand-800 hover:underline">{p.invoice.number}</Link></td>
                    <td className={tableClasses.td}>{p.invoice.customer.organizationName}</td>
                    <td className={tableClasses.td}>{formatRupees(p.amount.toString())}</td>
                    <td className={tableClasses.td}>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</td>
                    <td className={tableClasses.td}>{p.recordedBy?.name ?? "—"}</td>
                    <td className={tableClasses.td}><StatusBadge status={p.status} label={p.status === "FAILED" ? "Reversed" : undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} basePath="/admin/payments" />
      </section>
    </div>
  );
}
