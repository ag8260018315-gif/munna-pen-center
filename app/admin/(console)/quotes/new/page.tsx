import type { Metadata } from "next";
import { createQuoteForCustomerAction } from "@/app/actions/admin-sales";
import { Backlink } from "@/components/admin/backlink";
import { NewQuoteForm } from "@/components/admin/sales-forms";
import { DatabaseRequired, Notice, PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listCustomerOptions } from "@/lib/admin/customer-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "New quotation" };

export default async function NewQuotePage() {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const customers = await listCustomerOptions();
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Backlink href="/admin/quotes">Quotations</Backlink>
      <PageHeader title="New quotation" intro="Choose the customer. You add the items and prices on the next screen." />
      {customers.length === 0 ? (
        <>
          <Notice kind="info">There are no customers yet. Add one first, or open an enquiry and press “Create quotation”.</Notice>
          <div><ButtonLink href="/admin/customers/new">Add customer</ButtonLink></div>
        </>
      ) : (
        <NewQuoteForm action={createQuoteForCustomerAction} customers={customers} />
      )}
    </div>
  );
}
