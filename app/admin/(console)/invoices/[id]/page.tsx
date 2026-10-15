import { Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { issueInvoiceAction, recordPaymentAction, reversePaymentAction, saveInvoiceDraftAction, saveInvoiceLineHsnAction, voidInvoiceAction } from "@/app/actions/admin-billing";
import { Backlink } from "@/components/admin/backlink";
import { InvoiceDraftForm, IssueInvoiceForm, LineHsnForm, PaymentForm, ReasonForm } from "@/components/admin/billing-forms";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { getInvoice } from "@/lib/admin/invoice-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { amountInWords, GST_STATES, stateByCode, stateCodeFromGstin, placeOfSupplyCode } from "@/lib/domain/gst";
import { formatRupees } from "@/lib/domain/quote-math";
import { joinAddress } from "@/lib/domain/supplier";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation/admin-sales";

export const metadata: Metadata = { title: "Invoice" };

const DONE: Record<string, string> = {
  issued: "Invoice issued. It now has its number and can no longer be edited.",
  void: "Invoice voided. Its number stays used; the order can be invoiced again.",
  payment: "Payment recorded.",
  reversed: "Payment reversed.",
};
const dateText = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(d) : "—");
const hasKey = <T extends object>(table: T, key: string | undefined): key is Extract<keyof T, string> => key !== undefined && Object.hasOwn(table, key);
const dateInput = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const owner = session.role === "OWNER";
  const draft = !inv.issued;
  const m = (v: { toString(): string } | string) => formatRupees(v.toString());
  const customer = inv.customer;
  const buyerAddress = inv.issued ? (inv.buyerAddress ?? "") : joinAddress({ line1: customer.billingLine1, city: customer.billingCity, state: customer.billingState, pincode: customer.billingPincode });
  const buyerGstin = inv.issued ? inv.buyerGstin : customer.gstin;
  const posCode = placeOfSupplyCode(inv.placeOfSupply);
  const missingHsn = inv.items.filter((i) => !i.hsnCode).length;
  const tax = inv.tax;
  const totalText = inv.issued ? inv.total.toString() : (tax?.total ?? null);
  const orderTotal = inv.order.total.toString();
  const confirmedPayments = inv.payments.filter((p) => p.status === "CONFIRMED");
  const today = dateInput(new Date());

  // Why a draft can not be issued yet (the owner sees this beside the button).
  const blockers: string[] = [];
  if (draft) {
    if (inv.supplierProblem) blockers.push(inv.supplierProblem);
    if (!inv.orderUsable) blockers.push(`The order is ${inv.order.status.toLowerCase().replaceAll("_", " ")}, so this invoice can not be issued.`);
    if (!posCode) blockers.push("Choose the place of supply above and save.");
    if (!buyerAddress) blockers.push("The customer has no billing address. Add it on the customer's page.");
    if (!inv.customerGstinOk) blockers.push("The customer's GSTIN does not pass its check, so it was probably mistyped. Correct it on the customer's page.");
    if (inv.dueDate && dateInput(inv.dueDate) < today) blockers.push("The due date is before today. Change or clear it above and save.");
  }
  const writtenState = inv.order.shippingState?.trim();

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8">
      <Backlink href="/admin/invoices">Invoices</Backlink>
      <PageHeader
        title={inv.number ?? "Draft invoice"}
        intro={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={inv.status} />
            <span>
              for <Link className="font-semibold text-brand-800 underline" href={`/admin/customers/${customer.id}`}>{customer.organizationName}</Link>
            </span>
            <Link className="text-brand-800 underline" href={`/admin/orders/${inv.order.id}`}>Order {inv.order.number}</Link>
          </span>
        }
      />
      {hasKey(DONE, done) && <Notice kind="success">{DONE[done]}</Notice>}
      {draft && <Notice kind="info">This is a draft, not a tax invoice. The figures below are a preview; they are fixed, and the invoice gets its number, only when the owner issues it.</Notice>}
      {inv.issued && !inv.taxMatchesStored && <Notice kind="error">The tax worked out from this invoice&apos;s items does not match the totals stored when it was issued. Do not send it; check with the developer.</Notice>}

      <section aria-labelledby="parties" className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
        <h2 id="parties" className="sr-only">Seller and buyer</h2>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Sold by</h3>
          {inv.issued ? (
            <>
              <p className="mt-1 font-semibold">{inv.supplierName}</p>
              <p className="text-sm">{inv.supplierAddress}</p>
              <p className="text-sm">GSTIN: {inv.supplierGstin}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {inv.supplierReady ? <>Your business details are added when the invoice is issued (GSTIN registered in {inv.supplierStateName ?? "your state"}).</> : "The business GSTIN is not set up on the server yet."}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Bill to</h3>
          <p className="mt-1 font-semibold">{inv.issued ? inv.buyerName : customer.organizationName}</p>
          <p className="text-sm">{buyerAddress || <span className="text-red-700">No billing address — <Link className="underline" href={`/admin/customers/${customer.id}`}>add it</Link></span>}</p>
          <p className="text-sm">{buyerGstin ? `GSTIN: ${buyerGstin}` : "GSTIN: not given (unregistered buyer)"}</p>
          {draft && !inv.customerGstinOk && <p className="mt-1 text-sm font-medium text-red-700">This GSTIN does not pass its check — it was probably mistyped. <Link className="underline" href={`/admin/customers/${customer.id}`}>Correct it</Link> before issuing.</p>}
          {draft && buyerGstin && posCode && stateCodeFromGstin(buyerGstin) !== posCode && (
            <p className="mt-1 text-sm text-muted">Their GSTIN is registered in {stateByCode(stateCodeFromGstin(buyerGstin))?.name ?? "another state"}; the place of supply follows where the goods are delivered.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="supply">
        <h2 id="supply" className="text-xl font-extrabold">{draft ? "Place of supply and due date" : "Supply"}</h2>
        {draft ? (
          <div className="mt-4">
            <InvoiceDraftForm
              action={saveInvoiceDraftAction.bind(null, inv.id)}
              values={{ placeOfSupplyCode: posCode ?? "", dueDate: inv.dueDate ? dateInput(inv.dueDate) : "" }}
              states={GST_STATES.map((s) => ({ code: s.code, name: s.name }))}
            />
          </div>
        ) : (
          <dl className="mt-4 grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-3">
            <div><dt className="text-sm font-semibold text-muted">Issue date</dt><dd className="mt-1">{dateText(inv.issueDate)}</dd></div>
            <div><dt className="text-sm font-semibold text-muted">Place of supply</dt><dd className="mt-1">{inv.placeOfSupply}</dd></div>
            <div><dt className="text-sm font-semibold text-muted">Payment due</dt><dd className="mt-1">{inv.dueDate ? dateText(inv.dueDate) : "No due date"}</dd></div>
          </dl>
        )}
        {draft && (
          <div className="mt-3 grid gap-2 text-sm">
            <p>
              <strong>Delivery address on the order:</strong> {inv.deliveryAddress || <span className="text-red-700">none written</span>}
            </p>
            {!writtenState && inv.deliveryAddress && <Notice kind="info">The delivery address on the order has no state, so no place of supply was suggested. Choose it above.</Notice>}
            {writtenState && !inv.deliveryState && <Notice kind="info">The delivery state on the order (“{writtenState}”) is not a state this system recognises, so no place of supply was suggested. Choose it above.</Notice>}
            {inv.deliveryState && posCode && inv.deliveryState.code !== posCode && <Notice kind="info">The order is being delivered to {inv.deliveryState.name}, but the place of supply above is {stateByCode(posCode)?.name}. That is right only if the goods really go to {stateByCode(posCode)?.name}.</Notice>}
          </div>
        )}
        {draft && inv.mode && <p className="mt-3 text-sm text-muted">{inv.mode === "INTRA_STATE" ? "Same state as the seller: the tax is split into CGST and SGST." : "Different state from the seller: the tax is IGST."}</p>}
      </section>

      <section aria-labelledby="items">
        <h2 id="items" className="text-xl font-extrabold">Items</h2>
        {draft && missingHsn > 0 && <div className="mt-3"><Notice kind="info">{missingHsn === 1 ? "One item has" : `${missingHsn} items have`} no HSN code. Ask your accountant whether HSN codes are required on your invoices; the owner can enter them below.</Notice></div>}
        <div className={`${tableClasses.wrap} mt-4`}>
          <table className={`${tableClasses.table} min-w-[52rem]`}>
            <caption className="sr-only">Items on this invoice</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Item</th>
                <th scope="col" className={tableClasses.th}>HSN</th>
                <th scope="col" className={tableClasses.th}>Qty</th>
                <th scope="col" className={tableClasses.th}>Rate</th>
                <th scope="col" className={tableClasses.th}>Taxable value</th>
                <th scope="col" className={tableClasses.th}>GST %</th>
                {tax && (tax.mode === "INTRA_STATE" ? (
                  <>
                    <th scope="col" className={tableClasses.th}>CGST</th>
                    <th scope="col" className={tableClasses.th}>SGST</th>
                  </>
                ) : (
                  <th scope="col" className={tableClasses.th}>IGST</th>
                ))}
                <th scope="col" className={tableClasses.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, n) => (
                <tr key={item.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}>{item.description}</th>
                  <td className={tableClasses.td}>
                    {draft && owner ? <LineHsnForm action={saveInvoiceLineHsnAction.bind(null, item.id)} lineKey={item.id} itemName={item.description} value={item.hsnCode ?? ""} disabled={false} /> : (item.hsnCode ?? <span className="text-muted">—</span>)}
                  </td>
                  <td className={tableClasses.td}>{item.quantity} {item.unit}</td>
                  <td className={tableClasses.td}>{m(item.unitPrice)}</td>
                  <td className={tableClasses.td}>{m(item.lineTotal)}</td>
                  <td className={tableClasses.td}>{item.gstRatePercent.toString()}%</td>
                  {tax && (tax.mode === "INTRA_STATE" ? (
                    <>
                      <td className={tableClasses.td}>{m(tax.lines[n]!.cgst)}</td>
                      <td className={tableClasses.td}>{m(tax.lines[n]!.sgst)}</td>
                    </>
                  ) : (
                    <td className={tableClasses.td}>{m(tax.lines[n]!.igst)}</td>
                  ))}
                  <td className={tableClasses.td}>{tax ? m(tax.lines[n]!.total) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!tax && draft && <p className="mt-3 text-sm text-muted">The tax split appears once the place of supply is chosen{inv.supplierReady ? "" : " and the business GSTIN is set up"}.</p>}
      </section>

      {tax && (
        <section aria-labelledby="totals" className="grid gap-5 rounded-xl border border-line bg-white p-5">
          <h2 id="totals" className="text-lg font-extrabold">Totals{draft ? " (preview)" : ""}</h2>
          <div className={tableClasses.wrap}>
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Tax by rate</caption>
              <thead>
                <tr>
                  <th scope="col" className={tableClasses.th}>GST rate</th>
                  <th scope="col" className={tableClasses.th}>Taxable value</th>
                  {tax.mode === "INTRA_STATE" ? (<><th scope="col" className={tableClasses.th}>CGST</th><th scope="col" className={tableClasses.th}>SGST</th></>) : <th scope="col" className={tableClasses.th}>IGST</th>}
                </tr>
              </thead>
              <tbody>
                {tax.byRate.map((r) => (
                  <tr key={r.ratePercent}>
                    <th scope="row" className={`${tableClasses.td} font-semibold`}>{r.ratePercent}%</th>
                    <td className={tableClasses.td}>{m(r.taxable)}</td>
                    {tax.mode === "INTRA_STATE" ? (<><td className={tableClasses.td}>{m(r.cgst)}</td><td className={tableClasses.td}>{m(r.sgst)}</td></>) : <td className={tableClasses.td}>{m(r.igst)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
            <dt>Taxable value</dt><dd className="text-right">{m(tax.subtotal)}</dd>
            {tax.mode === "INTRA_STATE" ? (<><dt>CGST</dt><dd className="text-right">{m(tax.cgstTotal)}</dd><dt>SGST</dt><dd className="text-right">{m(tax.sgstTotal)}</dd></>) : (<><dt>IGST</dt><dd className="text-right">{m(tax.igstTotal)}</dd></>)}
            <dt className="font-extrabold">Invoice total</dt><dd className="text-right font-extrabold">{m(tax.total)}</dd>
          </dl>
          {totalText && <p className="text-sm"><strong>In words:</strong> {amountInWords(totalText)}</p>}
          {tax.mode === "INTRA_STATE" && Number(tax.total) !== Number(orderTotal) && (
            <p className="text-sm text-muted">The order total was {m(orderTotal)}. A tax invoice works out GST line by line, and for a same-state sale each half (CGST, SGST) is rounded on its own, so a line can come out a paisa different from the order — and the total with it.</p>
          )}
        </section>
      )}

      {draft && (
        <section aria-labelledby="issue" className="rounded-xl border border-line bg-white p-5">
          <h2 id="issue" className="text-xl font-extrabold">Issue</h2>
          {owner ? (
            <div className="mt-4"><IssueInvoiceForm action={issueInvoiceAction.bind(null, inv.id)} reviewKey={inv.reviewKey} ready={blockers.length === 0} blocker={blockers.length ? blockers.join(" ") : undefined} /></div>
          ) : (
            <p className="mt-2 text-sm text-muted">Only the owner can issue an invoice. When the details above are right, ask the owner to open this page and issue it.</p>
          )}
        </section>
      )}

      {inv.issued && (
        <>
          <section aria-labelledby="print" className="rounded-xl border border-line bg-white p-5">
            <h2 id="print" className="text-xl font-extrabold">Print or save as PDF</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["original", "duplicate", "triplicate"] as const).map((copy) => (
                <Link key={copy} href={`/admin/invoices/${inv.id}/print?copy=${copy}`} target="_blank" className={buttonStyles({ variant: "secondary" })}>
                  <Printer className="size-4" aria-hidden="true" /> {copy === "original" ? "Original (for the buyer)" : copy === "duplicate" ? "Duplicate (for the transporter)" : "Triplicate (for you)"}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">This system does not send invoices. Print or save the PDF and send it yourself.</p>
          </section>

          {(inv.status !== "VOID" || inv.payments.length > 0) && (
          <section aria-labelledby="payments" className="grid gap-5 rounded-xl border border-line bg-white p-5">
            <h2 id="payments" className="text-xl font-extrabold">Payments</h2>
            {inv.status !== "VOID" && (
              <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
                <dt>Invoice total</dt><dd className="text-right">{m(inv.total)}</dd>
                <dt>Received</dt><dd className="text-right">{m(inv.paid)}</dd>
                <dt className="font-extrabold">Still owed</dt><dd className="text-right font-extrabold">{m(inv.outstanding)}</dd>
              </dl>
            )}
            {inv.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded.</p>
            ) : (
              <div className={tableClasses.wrap}>
                <table className={tableClasses.table}>
                  <caption className="sr-only">Payments on this invoice</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={tableClasses.th}>Date</th>
                      <th scope="col" className={tableClasses.th}>Amount</th>
                      <th scope="col" className={tableClasses.th}>How</th>
                      <th scope="col" className={tableClasses.th}>Reference</th>
                      <th scope="col" className={tableClasses.th}>Recorded by</th>
                      <th scope="col" className={tableClasses.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.payments.map((p) => (
                      <tr key={p.id}>
                        <th scope="row" className={`${tableClasses.td} font-semibold`}>{dateText(p.paidAt)}</th>
                        <td className={tableClasses.td}>{m(p.amount)}</td>
                        <td className={tableClasses.td}>{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</td>
                        <td className={tableClasses.td}>{p.reference ?? "—"}{p.notes && <span className="block whitespace-pre-wrap text-xs text-muted">{p.notes}</span>}</td>
                        <td className={tableClasses.td}>{p.recordedBy?.name ?? "—"}</td>
                        <td className={tableClasses.td}><StatusBadge status={p.status} label={p.status === "FAILED" ? "Reversed" : undefined} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && (
              <div>
                <h3 className="mb-3 font-bold">Record a payment</h3>
                <PaymentForm action={recordPaymentAction.bind(null, inv.id)} today={today} minDate={inv.minPaymentDate} outstanding={m(inv.outstanding)} methods={PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }))} />
                <p className="mt-3 text-sm text-muted">Record only money that has already arrived. This system never asks anyone for money or moves it.</p>
              </div>
            )}

            {owner && confirmedPayments.length > 0 && (
              <details className="rounded-lg border border-line p-4">
                <summary className="cursor-pointer font-semibold">Entered by mistake, or the cheque bounced? Reverse a payment</summary>
                <div className="mt-4 grid gap-5">
                  {confirmedPayments.map((p) => (
                    <div key={p.id}>
                      <p className="mb-2 text-sm font-semibold">{dateText(p.paidAt)} · {m(p.amount)} · {PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</p>
                      <ReasonForm action={reversePaymentAction.bind(null, p.id)} id={`reverse-${p.id}`} label="Why is it being reversed?" submitLabel="Reverse this payment" />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
          )}

          {owner && inv.status === "ISSUED" && confirmedPayments.length === 0 && (
            <section aria-labelledby="void" className="rounded-xl border border-red-200 bg-white p-5">
              <h2 id="void" className="text-xl font-extrabold">Cancel this invoice</h2>
              <p className="mt-1 text-sm text-muted">If the invoice was wrong, void it, then make a new one from the order. Its number stays used and is shown as void; numbers are never reused.</p>
              <div className="mt-4"><ReasonForm action={voidInvoiceAction.bind(null, inv.id)} id="void-reason" label="Why is it being voided?" submitLabel="Void invoice" /></div>
            </section>
          )}
          {inv.status === "VOID" && <Notice kind="info">This invoice is void. It keeps its number and is not a valid tax invoice.</Notice>}
        </>
      )}
    </div>
  );
}
