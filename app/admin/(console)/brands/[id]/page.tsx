import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveBrandAction } from "@/app/actions/admin-catalogue";
import { Backlink } from "@/components/admin/backlink";
import { BrandForm } from "@/components/admin/catalogue-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { getBrand } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Edit brand" };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const brand = await getBrand((await params).id);
  if (!brand) notFound();
  const values = { name: brand.name, slug: brand.slug, sortOrder: String(brand.sortOrder), ...(brand.isActive ? { isActive: "on" } : {}), ...(brand.isListedPublicly ? { isListedPublicly: "on" } : {}) };
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/brands">Brands</Backlink>
      <PageHeader title={brand.name} />
      <BrandForm action={saveBrandAction.bind(null, brand.id)} values={values} submitLabel="Save changes" />
    </div>
  );
}
