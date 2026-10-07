import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin-catalogue";
import { ProductForm } from "@/components/admin/catalogue-forms";
import { Backlink } from "@/components/admin/backlink";
import { DatabaseRequired, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getCatalogueOptions, getProductForEdit } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const { id } = await params;
  const [product, { categories, brands }] = await Promise.all([getProductForEdit(id), getCatalogueOptions()]);
  if (!product) notFound();
  const owner = session.role === "OWNER";
  const text = (v: string | number | null) => (v === null ? "" : String(v));
  const values: Record<string, string> = {
    name: product.name, slug: product.slug, categoryId: product.categoryId, brandId: product.brandId ?? "",
    shortDescription: text(product.shortDescription), description: text(product.description), unit: text(product.unit), packSize: text(product.packSize),
    sku: text(product.sku), hsnCode: text(product.hsnCode), gstRatePercent: text(product.gstRatePercent),
    // Staff never receive price values in the page.
    purchasePrice: owner ? text(product.purchasePrice) : "", wholesalePrice: owner ? text(product.wholesalePrice) : "", retailPrice: owner ? text(product.retailPrice) : "",
    stockQuantity: text(product.stockQuantity), minOrderQuantity: text(product.minOrderQuantity), tags: product.tags.join(", "), status: product.status,
    ...(product.isFeatured ? { isFeatured: "on" } : {}),
  };
  if (!owner) {
    values.gstRatePercent = "";
    values.hsnCode = "";
  }
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/products">Products</Backlink>
      <PageHeader title={product.name} intro={<StatusBadge status={product.status} />} />
      <ProductForm action={saveProductAction.bind(null, product.id)} values={values} categories={categories} brands={brands} canEditPrices={owner} submitLabel="Save changes" />
    </div>
  );
}
