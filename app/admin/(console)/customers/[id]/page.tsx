import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveCustomerAction } from "@/app/actions/admin-sales";
import { Backlink } from "@/components/admin/backlink";
import { CustomerForm } from "@/components/admin/sales-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { getCustomer } from "@/lib/admin/customer-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const c = await getCustomer((await params).id);
  if (!c) notFound();
  const t = (v: string | null) => v ?? "";
  const values = {
    type: c.type, organizationName: c.organizationName, contactName: c.contactName, phone: c.phone, email: t(c.email), gstin: t(c.gstin),
    billingLine1: t(c.billingLine1), billingCity: t(c.billingCity), billingState: t(c.billingState), billingPincode: t(c.billingPincode), notes: t(c.notes),
  };
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/customers">Customers</Backlink>
      <PageHeader title={c.organizationName} />
      <CustomerForm action={saveCustomerAction.bind(null, c.id)} values={values} submitLabel="Save changes" />
    </div>
  );
}
