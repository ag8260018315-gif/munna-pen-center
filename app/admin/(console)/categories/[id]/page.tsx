import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveCategoryAction } from "@/app/actions/admin-catalogue";
import { Backlink } from "@/components/admin/backlink";
import { CategoryForm } from "@/components/admin/catalogue-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { getCategory } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const c = await getCategory((await params).id);
  if (!c) notFound();
  const values = { name: c.name, slug: c.slug, summary: c.summary ?? "", description: c.description ?? "", sortOrder: String(c.sortOrder), ...(c.isActive ? { isActive: "on" } : {}) };
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/categories">Categories</Backlink>
      <PageHeader title={c.name} />
      <CategoryForm action={saveCategoryAction.bind(null, c.id)} values={values} submitLabel="Save changes" />
    </div>
  );
}
