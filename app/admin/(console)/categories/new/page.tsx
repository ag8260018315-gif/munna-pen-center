import type { Metadata } from "next";
import { saveCategoryAction } from "@/app/actions/admin-catalogue";
import { Backlink } from "@/components/admin/backlink";
import { CategoryForm } from "@/components/admin/catalogue-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Add category" };

export default async function NewCategoryPage() {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/categories">Categories</Backlink>
      <PageHeader title="Add category" />
      <CategoryForm action={saveCategoryAction.bind(null, null)} values={{ isActive: "on" }} submitLabel="Add category" />
    </div>
  );
}
