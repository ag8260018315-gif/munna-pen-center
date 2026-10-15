import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { DatabaseRequired } from "@/components/admin/ui";
import { getInvoice } from "@/lib/admin/invoice-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { amountInWords } from "@/lib/domain/gst";
import { formatRupees } from "@/lib/domain/quote-math";


const COPY: Record<string, string> = {
  original: "Original for recipient",
  duplicate: "Duplicate for transporter",
  triplicate: "Triplicate for supplier",
};
const copyKey = (copy: string | undefined) => (copy !== undefined && Object.hasOwn(COPY, copy) ? copy : "original");
const dateText = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(d) : "");

/** The page title becomes the default file name of "Save as PDF", so each invoice and copy gets its own ("INV-26-27-0001 original"). */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> }): Promise<Metadata> {
  await requireAdmin();
  const [{ id }, { copy }] = await Promise.all([params, searchParams]);
  const inv = isDatabaseConfigured() ? await getInvoice(id) : null;
  const name = inv?.number ? inv.number.replaceAll("/", "-") : "Tax invoice";
  return { title: { absolute: `${name} ${copyKey(copy)}` } };
}

/**
 * The tax invoice, for printing or saving as a PDF. Everything on it comes from the invoice as issued (the seller's and buyer's
 * details were frozen on it), never from today's customer record. Only issued invoices can be printed.
 */
export default async function InvoicePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [{ id }, { copy }] = await Promise.all([params, searchParams]);
  const inv = await getInvoice(id);
  if (!inv || !inv.issued || !inv.tax || !inv.number) notFound();
  const tax = inv.tax;
  const intra = tax.mode === "INTRA_STATE";
  const m = (v: { toString(): string } | string) => formatRupees(v.toString());
  const copyLabel = COPY[copyKey(copy)]!;
  const shipTo = inv.deliveryAddress && inv.deliveryAddress.toLowerCase() !== (inv.buyerAddress ?? "").toLowerCase() ? inv.deliveryAddress : null;
  const void_ = inv.status === "VOID";

  return (
    <article>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      {void_ && <p className="mb-4 border-2 border-red-700 p-2 text-center text-lg font-extrabold uppercase text-red-800">Void — this invoice has been cancelled</p>}
      {!inv.taxMatchesStored && <p className="mb-4 border-2 border-red-700 p-2 text-center font-bold text-red-800">The tax on this invoice does not match what was stored. Do not send it.</p>}

      <header className="border-b-2 border-slate-400 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Tax Invoice</h1>
          <p className="text-xs font-bold uppercase tracking-wide">{copyLabel}</p>
        </div>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-lg font-extrabold">{inv.supplierName}</p>
            <p>{inv.supplierAddress}</p>
            <p>GSTIN: <strong>{inv.supplierGstin}</strong></p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 sm:text-right">
            <dt className="font-semibold">Invoice no.</dt><dd className="font-bold">{inv.number}</dd>
            <dt className="font-semibold">Date</dt><dd>{dateText(inv.issueDate)}</dd>
            {inv.dueDate && (<><dt className="font-semibold">Due date</dt><dd>{dateText(inv.dueDate)}</dd></>)}
            <dt className="font-semibold">Order</dt><dd>{inv.order.number}</dd>
          </dl>
        </div>
      </header>

      <section aria-labelledby="buyer" className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <h2 id="buyer" className="text-xs font-bold uppercase tracking-wide text-slate-600">Bill to</h2>
          <p className="font-semibold">{inv.buyerName}</p>
          <p>{inv.buyerAddress}</p>
          <p>{inv.buyerGstin ? <>GSTIN: <strong>{inv.buyerGstin}</strong></> : "GSTIN: unregistered / not provided"}</p>
          {shipTo && <p className="mt-1"><span className="font-semibold">Ship to:</span> {shipTo}</p>}
        </div>
        <div className="sm:text-right">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Place of supply</h2>
          <p className="font-semibold">{inv.placeOfSupply}</p>
          <p>Tax payable on reverse charge: No</p>
        </div>
      </section>

      <table className="mt-5 w-full border-collapse text-xs">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="border-b-2 border-slate-400 text-left align-bottom">
            <th scope="col" className="py-2 pr-2">#</th>
            <th scope="col" className="py-2 pr-2">Description</th>
            <th scope="col" className="py-2 pr-2">HSN</th>
            <th scope="col" className="py-2 pr-2 text-right">Qty</th>
            <th scope="col" className="py-2 pr-2 text-right">Rate</th>
            <th scope="col" className="py-2 pr-2 text-right">Taxable value</th>
            {intra ? (<><th scope="col" className="py-2 pr-2 text-right">CGST</th><th scope="col" className="py-2 pr-2 text-right">SGST</th></>) : <th scope="col" className="py-2 pr-2 text-right">IGST</th>}
            <th scope="col" className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, n) => {
            const line = tax.lines[n]!;
            return (
              <tr key={item.id} className="break-inside-avoid border-b border-slate-200 align-top">
                <td className="py-1.5 pr-2">{n + 1}</td>
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">{item.description}</th>
                <td className="py-1.5 pr-2">{item.hsnCode ?? ""}</td>
                <td className="py-1.5 pr-2 text-right">{item.quantity} {item.unit}</td>
                <td className="py-1.5 pr-2 text-right">{m(item.unitPrice)}</td>
                <td className="py-1.5 pr-2 text-right">{m(line.taxable)}</td>
                {intra ? (
                  <>
                    <td className="py-1.5 pr-2 text-right">{m(line.cgst)}<span className="block text-slate-600">@ {Number(item.gstRatePercent) / 2}%</span></td>
                    <td className="py-1.5 pr-2 text-right">{m(line.sgst)}<span className="block text-slate-600">@ {Number(item.gstRatePercent) / 2}%</span></td>
                  </>
                ) : (
                  <td className="py-1.5 pr-2 text-right">{m(line.igst)}<span className="block text-slate-600">@ {item.gstRatePercent.toString()}%</span></td>
                )}
                <td className="py-1.5 text-right">{m(line.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 grid break-inside-avoid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="text-sm">
          <p><strong>Amount in words:</strong> {amountInWords(inv.total.toString())}</p>
          <table className="mt-3 border-collapse text-xs">
            <caption className="sr-only">Tax by rate</caption>
            <thead>
              <tr className="border-b border-slate-400 text-left">
                <th scope="col" className="pr-4 py-1">GST rate</th>
                <th scope="col" className="pr-4 py-1 text-right">Taxable value</th>
                {intra ? (<><th scope="col" className="pr-4 py-1 text-right">CGST</th><th scope="col" className="py-1 text-right">SGST</th></>) : <th scope="col" className="py-1 text-right">IGST</th>}
              </tr>
            </thead>
            <tbody>
              {tax.byRate.map((r) => (
                <tr key={r.ratePercent}>
                  <th scope="row" className="pr-4 py-1 text-left font-medium">{r.ratePercent}%</th>
                  <td className="pr-4 py-1 text-right">{m(r.taxable)}</td>
                  {intra ? (<><td className="pr-4 py-1 text-right">{m(r.cgst)}</td><td className="py-1 text-right">{m(r.sgst)}</td></>) : <td className="py-1 text-right">{m(r.igst)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="grid min-w-56 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt>Taxable value</dt><dd className="text-right">{m(inv.subtotal)}</dd>
          {intra ? (<><dt>CGST</dt><dd className="text-right">{m(inv.cgstTotal)}</dd><dt>SGST</dt><dd className="text-right">{m(inv.sgstTotal)}</dd></>) : (<><dt>IGST</dt><dd className="text-right">{m(inv.igstTotal)}</dd></>)}
          <dt className="border-t border-slate-400 pt-1 text-base font-extrabold">Total</dt><dd className="border-t border-slate-400 pt-1 text-right text-base font-extrabold">{m(inv.total)}</dd>
        </dl>
      </div>

      <footer className="mt-10 flex break-inside-avoid items-end justify-between gap-6 text-sm">
        <p className="text-xs text-slate-600">This is a computer-generated invoice.</p>
        <div className="text-right">
          <p className="font-semibold">For {inv.supplierName}</p>
          <p className="mt-10 border-t border-slate-400 pt-1 text-xs">Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}
