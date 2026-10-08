import type { Metadata } from "next";
import { saveCustomerAction } from "@/app/actions/admin-sales";
import { Backlink } from "@/components/admin/backlink";
import { CustomerForm } from "@/components/admin/sales-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/customers">Customers</Backlink>
      <PageHeader title="Add customer" />
      <CustomerForm action={saveCustomerAction.bind(null, null)} values={{ type: "OTHER" }} submitLabel="Add customer" />
    </div>
  );
}
