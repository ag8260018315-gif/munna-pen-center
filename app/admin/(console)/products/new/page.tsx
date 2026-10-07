import type { Metadata } from "next";
import { saveProductAction } from "@/app/actions/admin-catalogue";
import { ProductForm } from "@/components/admin/catalogue-forms";
import { Backlink } from "@/components/admin/backlink";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { getCatalogueOptions } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const { categories, brands } = await getCatalogueOptions();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/products">Products</Backlink>
      <PageHeader title="Add product" intro="Enter only what you know. Anything left blank stays empty — nothing is filled in for you." />
      <ProductForm action={saveProductAction.bind(null, null)} values={{}} categories={categories} brands={brands} canEditPrices={session.role === "OWNER"} submitLabel="Add product" />
    </div>
  );
}
