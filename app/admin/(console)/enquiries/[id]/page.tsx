import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Backlink } from "@/components/admin/backlink";
import { DatabaseRequired, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getEnquiry } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Enquiry" };

const when = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const enquiry = await getEnquiry((await params).id);
  if (!enquiry) notFound();
  const { lead } = enquiry;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/enquiries">Enquiries</Backlink>
      <PageHeader title={enquiry.reference} intro={<StatusBadge status={enquiry.status} />} />
      <dl className="grid gap-5 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
        <Row label="Received">{when(enquiry.createdAt)}</Row>
        <Row label="Source">{enquiry.source.replace(/_/g, " ").toLowerCase()}</Row>
        <Row label="Name">{lead.name}</Row>
        <Row label="Organisation">{lead.organizationName ?? "—"}</Row>
        <Row label="Phone">
          <a className="font-semibold text-brand-800 underline" href={`tel:${lead.phone}`}>{lead.phone}</a>
        </Row>
        <Row label="E-mail">{lead.email ? <a className="font-semibold text-brand-800 underline" href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}</Row>
        <Row label="City">{[enquiry.city ?? lead.city, enquiry.state ?? lead.state].filter(Boolean).join(", ") || "—"}</Row>
        <Row label="Approximate quantity">{enquiry.approximateQuantity ?? "—"}</Row>
        <div className="sm:col-span-2"><Row label="Products required">{enquiry.productsRequired}</Row></div>
        <div className="sm:col-span-2"><Row label="Additional requirements">{enquiry.additionalRequirements ?? "—"}</Row></div>
      </dl>
      {enquiry.items.length > 0 && (
        <section aria-labelledby="items">
          <h2 id="items" className="text-xl font-extrabold">Items</h2>
          <ul className="mt-3 grid gap-2">
            {enquiry.items.map((i) => (
              <li key={i.id} className="rounded-lg border border-line bg-white px-4 py-3">
                <span className="font-semibold">{i.productName}</span>
                {i.quantityNote && <span className="text-muted"> — {i.quantityNote}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
