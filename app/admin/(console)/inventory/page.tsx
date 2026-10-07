import type { Metadata } from "next";
import { updateStockAction } from "@/app/actions/admin-catalogue";
import { StockRowForm } from "@/components/admin/catalogue-forms";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { listInventory } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-5xl gap-6"><PageHeader title="Inventory" /><DatabaseRequired /></div>;
  const { items, page, pages } = await listInventory({ q: sp.q, page: Number(sp.page) || 1 });
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Inventory" intro="Update stock quantities. Leave a box empty if you do not track stock for a product; 0 means out of stock. Stock is never shown on the website." />
      <form method="get" role="search" aria-label="Search products" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">Search</label>
          <input id="q" name="q" defaultValue={sp.q} maxLength={80} placeholder="Name or SKU" className="h-11 w-64 max-w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Search</button>
      </form>
      {items.length === 0 ? (
        <Notice kind="info">No products to show.</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Stock by product</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Product</th>
                <th scope="col" className={tableClasses.th}>SKU</th>
                <th scope="col" className={tableClasses.th}>Status</th>
                <th scope="col" className={tableClasses.th}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}>{p.name}</th>
                  <td className={tableClasses.td}>{p.sku ?? <span className="text-muted">—</span>}</td>
                  <td className={tableClasses.td}><StatusBadge status={p.status} /></td>
                  <td className={tableClasses.td}>
                    <StockRowForm action={updateStockAction.bind(null, p.id)} id={p.id} label={p.name} value={p.stockQuantity === null ? "" : String(p.stockQuantity)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/inventory" params={{ q: sp.q }} />
    </div>
  );
}
