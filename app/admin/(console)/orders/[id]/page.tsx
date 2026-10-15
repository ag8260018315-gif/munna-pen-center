import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoiceDraftAction, dispatchOrderAction, orderStepAction, saveOrderDetailsAction } from "@/app/actions/admin-billing";
import { ActionButton, DispatchForm, OrderDetailsForm } from "@/components/admin/billing-forms";
import { Backlink } from "@/components/admin/backlink";
import { StatusButton } from "@/components/admin/sales-forms";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses } from "@/components/admin/ui";
import { getOrder } from "@/lib/admin/order-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";
import { splitNotes } from "@/lib/domain/order-log";
import { joinAddress } from "@/lib/domain/supplier";

export const metadata: Metadata = { title: "Order" };

const DONE: Record<string, string> = {
  CONFIRM: "Order confirmed.",
  PROCESS: "Marked as being processed.",
  DISPATCH: "Marked as dispatched.",
  DELIVER: "Marked as delivered.",
  CANCEL: "Order cancelled.",
};
const dateTime = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d) : "—");

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);
  if (!order) notFound();
  const owner = session.role === "OWNER";
  const editable = ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING"].includes(order.status);
  const liveInvoice = order.invoices.find((i) => i.status !== "VOID");
  const invoiced = order.invoices.some((i) => ["ISSUED", "PARTIALLY_PAID", "PAID"].includes(i.status)); // an issued invoice has to be voided before the order can be cancelled
  const notes = splitNotes(order.notes);
  const canInvoice = ["CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED"].includes(order.status) && !liveInvoice;
  const money = (v: { toString(): string }) => formatRupees(v.toString());

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8">
      <Backlink href="/admin/orders">Orders</Backlink>
      <PageHeader
        title={order.number}
        intro={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} />
            <span>
              for <Link className="font-semibold text-brand-800 underline" href={`/admin/customers/${order.customer.id}`}>{order.customer.organizationName}</Link> · {order.customer.contactName} · {order.customer.phone}
            </span>
            {order.quotation && <Link className="text-brand-800 underline" href={`/admin/quotes/${order.quotation.id}`}>Quotation {order.quotation.number}</Link>}
          </span>
        }
      />
      {done !== undefined && Object.hasOwn(DONE, done) && <Notice kind="success">{DONE[done]}</Notice>}

      <section aria-labelledby="items">
        <h2 id="items" className="text-xl font-extrabold">Items</h2>
        <p className="mt-1 text-sm text-muted">Copied from the accepted quotation. To change a price or quantity, make a new quotation.</p>
        <div className={`${tableClasses.wrap} mt-4`}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Items on {order.number}</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Item</th>
                <th scope="col" className={tableClasses.th}>Qty</th>
                <th scope="col" className={tableClasses.th}>Price (ex-GST)</th>
                <th scope="col" className={tableClasses.th}>GST</th>
                <th scope="col" className={tableClasses.th}>HSN</th>
                <th scope="col" className={tableClasses.th}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}>{item.description}</th>
                  <td className={tableClasses.td}>{item.quantity} {item.unit}</td>
                  <td className={tableClasses.td}>{money(item.unitPrice)}</td>
                  <td className={tableClasses.td}>{item.gstRatePercent.toString()}%</td>
                  <td className={tableClasses.td}>{item.hsnCode ?? <span className="text-muted">not set</span>}</td>
                  <td className={tableClasses.td}>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-xl border border-line bg-white p-5">
          <dt>Subtotal (ex-GST)</dt><dd className="text-right">{money(order.subtotal)}</dd>
          <dt>GST</dt><dd className="text-right">{money(order.taxTotal)}</dd>
          <dt className="font-extrabold">Total</dt><dd className="text-right font-extrabold">{money(order.total)}</dd>
        </dl>
      </section>

      <section aria-labelledby="progress" className="rounded-xl border border-line bg-white p-5">
        <h2 id="progress" className="text-xl font-extrabold">Progress</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="font-semibold text-muted">Created</dt><dd>{dateTime(order.createdAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Confirmed</dt><dd>{dateTime(order.confirmedAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Dispatched</dt><dd>{dateTime(order.dispatchedAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Delivered</dt><dd>{dateTime(order.deliveredAt)}</dd></div>
        </dl>
        {(order.transporter || order.trackingReference) && (
          <p className="mt-3 text-sm">Transport: <strong>{order.transporter ?? "—"}</strong> · Reference: <strong>{order.trackingReference ?? "—"}</strong></p>
        )}

        <div className="mt-5 grid gap-4">
          {order.status === "PENDING_CONFIRMATION" &&
            (owner ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatusButton action={orderStepAction.bind(null, order.id, "CONFIRM")} label="Confirm order" variant="primary" />
                <StatusButton action={orderStepAction.bind(null, order.id, "CANCEL")} label="Cancel order" />
              </div>
            ) : (
              <p className="text-sm text-muted">Waiting for the owner to confirm this order.</p>
            ))}
          {order.status === "CONFIRMED" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusButton action={orderStepAction.bind(null, order.id, "PROCESS")} label="Start processing" variant="primary" />
              {owner && !invoiced && <StatusButton action={orderStepAction.bind(null, order.id, "CANCEL")} label="Cancel order" />}
            </div>
          )}
          {order.status === "PROCESSING" && (
            <>
              <div>
                <h3 className="mb-3 font-bold">Dispatch</h3>
                <DispatchForm action={dispatchOrderAction.bind(null, order.id)} />
              </div>
              {owner && !invoiced && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatusButton action={orderStepAction.bind(null, order.id, "CANCEL")} label="Cancel order" />
                </div>
              )}
            </>
          )}
          {order.status === "DISPATCHED" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusButton action={orderStepAction.bind(null, order.id, "DELIVER")} label="Mark as delivered" variant="primary" />
            </div>
          )}
        </div>
        {!owner && <p className="mt-4 text-sm text-muted">Only the owner can confirm or cancel an order.</p>}
        {owner && invoiced && ["CONFIRMED", "PROCESSING"].includes(order.status) && <p className="mt-4 text-sm text-muted">This order has an issued invoice. To cancel the order, void the invoice first.</p>}
        <p className="mt-4 text-sm text-muted">Changing the status never sends anything to the customer and does not change stock.</p>
      </section>

      <section aria-labelledby="delivery">
        <h2 id="delivery" className="text-xl font-extrabold">Delivery and notes</h2>
        {editable ? (
          <div className="mt-4">
            <OrderDetailsForm
              action={saveOrderDetailsAction.bind(null, order.id)}
              values={{ shippingLine1: order.shippingLine1 ?? "", shippingCity: order.shippingCity ?? "", shippingState: order.shippingState ?? "", shippingPincode: order.shippingPincode ?? "", notes: notes.text }}
            />
          </div>
        ) : (
          <dl className="mt-4 grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted">Delivery address</dt><dd className="mt-1">{joinAddress({ line1: order.shippingLine1, city: order.shippingCity, state: order.shippingState, pincode: order.shippingPincode }) || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted">Internal notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{notes.text || "—"}</dd></div>
          </dl>
        )}
      </section>

      <section aria-labelledby="invoicing" className="rounded-xl border border-line bg-white p-5">
        <h2 id="invoicing" className="text-xl font-extrabold">Invoice</h2>
        {order.invoices.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {order.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/invoices/${inv.id}`} className="font-semibold text-brand-800 underline">{inv.number ?? "Draft invoice"}</Link>
                <StatusBadge status={inv.status} />
                {inv.number && <span className="text-sm text-muted">{money(inv.total)}</span>}
              </li>
            ))}
          </ul>
        )}
        {canInvoice && (
          <div className="mt-4">
            <ActionButton action={createInvoiceDraftAction.bind(null, order.id)} label="Create invoice (draft)" />
            <p className="mt-2 text-sm text-muted">A draft can be checked and corrected. Only the owner can issue it as a tax invoice.</p>
          </div>
        )}
        {!canInvoice && !liveInvoice && <p className="mt-2 text-sm text-muted">{order.status === "CANCELLED" ? "A cancelled order can not be invoiced." : "An invoice can be made once the owner has confirmed the order."}</p>}
      </section>

      {notes.log.length > 0 && (
        <section aria-labelledby="log" className="rounded-xl border border-line bg-white p-5">
          <h2 id="log" className="text-xl font-extrabold">History</h2>
          <p className="mt-1 text-sm text-muted">Written by the system when something important happens. It can not be edited.</p>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {notes.log.map((line, n) => (
              <li key={n} className="break-words">{line.replace(/^\[log\] /, "")}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
