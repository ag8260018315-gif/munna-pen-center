import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listCategories } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-5xl gap-6"><PageHeader title="Categories" /><DatabaseRequired /></div>;
  const categories = await listCategories();
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Categories" intro="Product types. Categories are separate from brands." actions={<ButtonLink href="/admin/categories/new">Add category</ButtonLink>} />
      {sp.saved && <Notice kind="success">Saved.</Notice>}
      {categories.length === 0 ? (
        <Notice kind="info">No categories yet.</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Categories ({categories.length})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Category</th>
                <th scope="col" className={tableClasses.th}>Web address</th>
                <th scope="col" className={tableClasses.th}>Products</th>
                <th scope="col" className={tableClasses.th}>Status</th>
                <th scope="col" className={tableClasses.th}>Order</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/categories/${c.id}`} className="text-brand-800 hover:underline">{c.name}</Link></th>
                  <td className={tableClasses.td}><code>{c.slug}</code></td>
                  <td className={tableClasses.td}>{c._count.products}</td>
                  <td className={tableClasses.td}><StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  <td className={tableClasses.td}>{c.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
