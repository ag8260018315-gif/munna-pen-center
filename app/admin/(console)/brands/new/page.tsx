import type { Metadata } from "next";
import { saveBrandAction } from "@/app/actions/admin-catalogue";
import { Backlink } from "@/components/admin/backlink";
import { BrandForm } from "@/components/admin/catalogue-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Add brand" };

export default async function NewBrandPage() {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/brands">Brands</Backlink>
      <PageHeader title="Add brand" />
      <BrandForm action={saveBrandAction.bind(null, null)} values={{ isActive: "on" }} submitLabel="Add brand" />
    </div>
  );
}
