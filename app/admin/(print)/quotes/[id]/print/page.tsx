import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { DatabaseRequired } from "@/components/admin/ui";
import { getQuotation } from "@/lib/admin/quotation-admin";
import { siteConfig } from "@/lib/config/site";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { formatRupees } from "@/lib/domain/quote-math";

export const metadata: Metadata = { title: "Quotation (print)" };

const dateText = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(d);

/**
 * A clean page to print or save as PDF. It shows the business details already published on the website (no GSTIN — the
 * public rule is "GST Registered" only; the GSTIN belongs on invoices, which come later) and never the internal notes.
 */
export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const quote = await getQuotation((await params).id);
  if (!quote) notFound();
  const { location, contact } = siteConfig;
  const address = [location.streetAddress, location.locality, location.region, location.postalCode].filter(Boolean).join(", ");
  const draft = quote.status === "DRAFT" || !quote.complete;

  return (
    <article>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold">{siteConfig.name}</h1>
          <p className="text-sm">{siteConfig.tagline}</p>
          <p className="mt-2 text-sm">{address}</p>
          <p className="text-sm">
            {contact.phoneDisplay}
            {contact.additionalPhones.map((p) => `, ${p.display}`).join("")}
            {contact.email ? ` · ${contact.email}` : ""}
          </p>
          {siteConfig.gst.registered && <p className="text-sm">GST Registered</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold">Quotation</p>
          <p className="font-semibold">{quote.number}</p>
          <p className="text-sm">Date: {dateText(quote.createdAt)}</p>
          {quote.validUntil && <p className="text-sm">Valid until: {dateText(quote.validUntil)}</p>}
          {draft && <p className="mt-1 inline-block border border-slate-500 px-2 text-xs font-bold uppercase">Draft — not final</p>}
        </div>
      </header>

      <section aria-labelledby="to" className="mt-5">
        <h2 id="to" className="text-sm font-bold uppercase tracking-wide text-slate-600">Prepared for</h2>
        <p className="font-semibold">{quote.customer.organizationName}</p>
        <p className="text-sm">{quote.customer.contactName} · {quote.customer.phone}</p>
        {quote.customer.billingLine1 && <p className="text-sm">{[quote.customer.billingLine1, quote.customer.billingCity, quote.customer.billingState, quote.customer.billingPincode].filter(Boolean).join(", ")}</p>}
        {quote.customer.gstin && <p className="text-sm">GSTIN: {quote.customer.gstin}</p>}
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="border-b-2 border-slate-400 text-left">
            <th scope="col" className="py-2 pr-2">#</th>
            <th scope="col" className="py-2 pr-2">Item</th>
            <th scope="col" className="py-2 pr-2 text-right">Qty</th>
            <th scope="col" className="py-2 pr-2 text-right">Price</th>
            <th scope="col" className="py-2 pr-2 text-right">GST</th>
            <th scope="col" className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, n) => (
            <tr key={item.id} className="border-b border-slate-200 align-top">
              <td className="py-2 pr-2">{n + 1}</td>
              <th scope="row" className="py-2 pr-2 text-left font-medium">{item.description}</th>
              <td className="py-2 pr-2 text-right">{item.quantity} {item.unit}</td>
              <td className="py-2 pr-2 text-right">{item.unitPrice ? formatRupees(item.unitPrice.toString()) : "—"}</td>
              <td className="py-2 pr-2 text-right">{item.gstRatePercent ? `${item.gstRatePercent}%` : "—"}</td>
              <td className="py-2 text-right">{quote.lineMath[n]!.lineTotal ? formatRupees(quote.lineMath[n]!.lineTotal) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {quote.total ? (
        <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt>Subtotal (prices exclude GST)</dt><dd className="text-right">{formatRupees(quote.subtotal?.toString())}</dd>
          <dt>GST</dt><dd className="text-right">{formatRupees(quote.taxTotal?.toString())}</dd>
          <dt className="font-extrabold">Total</dt><dd className="text-right font-extrabold">{formatRupees(quote.total.toString())}</dd>
        </dl>
      ) : (
        <p className="mt-4 text-sm font-semibold">Total not available yet — some items are not priced.</p>
      )}

      {quote.terms && (
        <section aria-labelledby="terms" className="mt-6">
          <h2 id="terms" className="text-sm font-bold uppercase tracking-wide text-slate-600">Terms</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{quote.terms}</p>
        </section>
      )}
    </article>
  );
}
