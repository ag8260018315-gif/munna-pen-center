import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses, YesNo } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listBrands } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-5xl gap-6"><PageHeader title="Brands" /><DatabaseRequired /></div>;
  const brands = await listBrands();
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Brands" intro="Brands you supply. Brands are separate from product categories." actions={<ButtonLink href="/admin/brands/new">Add brand</ButtonLink>} />
      {sp.saved && <Notice kind="success">Saved.</Notice>}
      {brands.length === 0 ? (
        <Notice kind="info">No brands yet.</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Brands ({brands.length})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Brand</th>
                <th scope="col" className={tableClasses.th}>Products</th>
                <th scope="col" className={tableClasses.th}>Status</th>
                <th scope="col" className={tableClasses.th}>On website</th>
                <th scope="col" className={tableClasses.th}>Order</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/brands/${b.id}`} className="text-brand-800 hover:underline">{b.name}</Link></th>
                  <td className={tableClasses.td}>{b._count.products}</td>
                  <td className={tableClasses.td}><StatusBadge status={b.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  <td className={tableClasses.td}><YesNo value={b.isListedPublicly} /></td>
                  <td className={tableClasses.td}>{b.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
