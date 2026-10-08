import { Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addQuoteLineAction, quoteStatusAction, removeQuoteLineAction, saveQuoteHeaderAction, updateQuoteLineAction } from "@/app/actions/admin-sales";
import { Backlink } from "@/components/admin/backlink";
import { LineForm, QuoteHeaderForm, StatusButton } from "@/components/admin/sales-forms";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { getQuotation, listProductOptions } from "@/lib/admin/quotation-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";
import { buildCustomerWhatsAppUrl, buildQuotationMessage } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Quotation" };

const DONE: Record<string, string> = {
  SENT: "Marked as sent. Remember: this system sends nothing by itself — use the WhatsApp or print buttons to share it.",
  ACCEPTED: "Marked as accepted.",
  REJECTED: "Marked as rejected.",
  EXPIRED: "Marked as expired.",
  CANCELLED: "Cancelled.",
};
const dateText = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(d);
const dateInput = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const quote = await getQuotation(id);
  if (!quote) notFound();
  const owner = session.role === "OWNER";
  const draft = quote.status === "DRAFT";
  const products = draft ? await listProductOptions() : [];

  const money = (v: { toString(): string } | null) => (v === null ? "—" : formatRupees(v.toString()));
  const note = (productName: string) => quote.enquiry?.items.find((i) => i.productName === productName)?.quantityNote ?? null;

  const shareUrl =
    quote.complete && quote.total && quote.subtotal && quote.taxTotal
      ? buildCustomerWhatsAppUrl(
          quote.customer.phone,
          buildQuotationMessage({
            contactName: quote.customer.contactName,
            number: quote.number,
            lines: quote.items.map((i, n) => ({ description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice!.toString(), lineTotal: quote.lineMath[n]!.lineTotal! })),
            subtotal: quote.subtotal.toString(),
            taxTotal: quote.taxTotal.toString(),
            total: quote.total.toString(),
            validUntilText: quote.validUntil ? dateText(quote.validUntil) : null,
            terms: quote.terms,
            format: formatRupees,
          }),
        )
      : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <Backlink href="/admin/quotes">Quotations</Backlink>
      <PageHeader
        title={quote.number}
        intro={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={quote.status} />
            <span>
              for <Link className="font-semibold text-brand-800 underline" href={`/admin/customers/${quote.customer.id}`}>{quote.customer.organizationName}</Link> · {quote.customer.contactName} · {quote.customer.phone}
            </span>
            {quote.enquiry && <Link className="text-brand-800 underline" href={`/admin/enquiries/${quote.enquiry.id}`}>Enquiry {quote.enquiry.reference}</Link>}
          </span>
        }
      />
      {done && DONE[done] && <Notice kind="success">{DONE[done]}</Notice>}

      {quote.enquiry && draft && (
        <section aria-labelledby="wrote" className="rounded-xl border border-line bg-white p-5">
          <h2 id="wrote" className="text-lg font-extrabold">What the customer asked for</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{quote.enquiry.productsRequired}</p>
          {quote.enquiry.approximateQuantity && <p className="mt-2 text-sm text-muted">Quantity they wrote: {quote.enquiry.approximateQuantity}</p>}
          <p className="mt-3 text-sm text-muted">Quantities below were read from their list where possible, otherwise set to 1 — check every quantity.</p>
        </section>
      )}

      <section aria-labelledby="lines">
        <h2 id="lines" className="text-xl font-extrabold">Items</h2>
        {draft ? (
          <div className="mt-4 grid gap-4">
            {quote.items.length === 0 && <Notice kind="info">No items yet. Add the first one below.</Notice>}
            {quote.items.map((item, n) => (
              <div key={item.id} className="rounded-xl border border-line bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold">Item {n + 1}</p>
                  <p className="text-sm text-muted">
                    Line total (ex-GST): <strong className="text-ink">{money(quote.lineMath[n]!.lineTotal)}</strong>
                    {quote.lineMath[n]!.tax !== null && <> · GST {formatRupees(quote.lineMath[n]!.tax!)}</>}
                  </p>
                </div>
                <LineForm
                  action={updateQuoteLineAction.bind(null, item.id)}
                  lineKey={item.id}
                  mode="edit"
                  canEditPrices={owner}
                  customerNote={note(item.description)}
                  values={{
                    description: item.description, quantity: String(item.quantity), unit: item.unit,
                    unitPrice: item.unitPrice?.toString() ?? "", gstRatePercent: item.gstRatePercent?.toString() ?? "", hsnCode: item.hsnCode ?? "",
                  }}
                />
                <form action={removeQuoteLineAction.bind(null, item.id)} className="mt-3">
                  <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-50">
                    Remove item {n + 1}
                  </button>
                </form>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-slate-400 bg-white p-5">
              <h3 className="mb-3 font-bold">Add an item</h3>
              <LineForm action={addQuoteLineAction.bind(null, quote.id)} lineKey="new" mode="add" canEditPrices={owner} products={products} values={{}} />
            </div>
          </div>
        ) : (
          <div className={`${tableClasses.wrap} mt-4`}>
            <table className={tableClasses.table}>
              <caption className="sr-only">Items on {quote.number}</caption>
              <thead>
                <tr>
                  <th scope="col" className={tableClasses.th}>Item</th>
                  <th scope="col" className={tableClasses.th}>Qty</th>
                  <th scope="col" className={tableClasses.th}>Price (ex-GST)</th>
                  <th scope="col" className={tableClasses.th}>GST</th>
                  <th scope="col" className={tableClasses.th}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, n) => (
                  <tr key={item.id}>
                    <th scope="row" className={`${tableClasses.td} font-semibold`}>{item.description}</th>
                    <td className={tableClasses.td}>{item.quantity} {item.unit}</td>
                    <td className={tableClasses.td}>{money(item.unitPrice)}</td>
                    <td className={tableClasses.td}>{item.gstRatePercent ? `${item.gstRatePercent}%` : "—"}</td>
                    <td className={tableClasses.td}>{money(quote.lineMath[n]!.lineTotal === null ? null : quote.lineMath[n]!.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="totals" className="rounded-xl border border-line bg-white p-5">
        <h2 id="totals" className="text-lg font-extrabold">Totals</h2>
        {quote.total ? (
          <dl className="mt-3 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
            <dt>Subtotal (ex-GST)</dt><dd className="text-right">{money(quote.subtotal)}</dd>
            <dt>GST</dt><dd className="text-right">{money(quote.taxTotal)}</dd>
            <dt className="font-extrabold">Total</dt><dd className="text-right font-extrabold">{money(quote.total)}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">No total yet — every item needs a price and a GST rate. Nothing is estimated.</p>
        )}
      </section>

      <section aria-labelledby="details">
        <h2 id="details" className="text-xl font-extrabold">Details</h2>
        {draft ? (
          <div className="mt-4">
            <QuoteHeaderForm
              action={saveQuoteHeaderAction.bind(null, quote.id)}
              values={{ validUntil: quote.validUntil ? dateInput(quote.validUntil) : "", terms: quote.terms ?? "", notes: quote.notes ?? "" }}
            />
          </div>
        ) : (
          <dl className="mt-4 grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
            <div><dt className="text-sm font-semibold text-muted">Valid until</dt><dd className="mt-1">{quote.validUntil ? dateText(quote.validUntil) : "No expiry"}</dd></div>
            <div><dt className="text-sm font-semibold text-muted">Marked as sent</dt><dd className="mt-1">{quote.sentAt ? dateText(quote.sentAt) : "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted">Terms</dt><dd className="mt-1 whitespace-pre-wrap">{quote.terms ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted">Internal notes</dt><dd className="mt-1 whitespace-pre-wrap">{quote.notes ?? "—"}</dd></div>
          </dl>
        )}
      </section>

      <section aria-labelledby="actions" className="rounded-xl border border-line bg-white p-5">
        <h2 id="actions" className="text-xl font-extrabold">Share and decide</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/quotes/${quote.id}/print`} className={buttonStyles({ variant: "secondary" })} target="_blank">
            <Printer className="size-4" aria-hidden="true" /> Print view
          </Link>
          {shareUrl && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles({ variant: "whatsapp" })}>
              Open in WhatsApp
            </a>
          )}
        </div>
        <p className="mt-3 text-sm text-muted">
          “Open in WhatsApp” only prepares the message in your own WhatsApp — you read it and press send. This system never sends anything to a customer.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {owner && quote.status === "DRAFT" && (
            <>
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "SENT")} label="Mark as sent" variant="primary" />
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "CANCELLED")} label="Cancel quotation" />
            </>
          )}
          {owner && quote.status === "SENT" && (
            <>
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "ACCEPTED")} label="Customer accepted" variant="primary" />
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "REJECTED")} label="Customer declined" />
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "EXPIRED")} label="Mark expired" />
              <StatusButton action={quoteStatusAction.bind(null, quote.id, "CANCELLED")} label="Cancel quotation" />
            </>
          )}
        </div>
        {!owner && <p className="mt-4 text-sm text-muted">Only the owner can mark a quotation as sent, accepted, declined or cancelled, and only the owner can enter prices, GST and HSN.</p>}
        {owner && draft && <p className="mt-4 text-sm text-muted">“Mark as sent” is available once every item has a price and a GST rate. After that the items can no longer be edited.</p>}
      </section>
    </div>
  );
}
