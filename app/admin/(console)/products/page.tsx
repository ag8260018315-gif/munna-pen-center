import type { Metadata } from "next";
import Link from "next/link";
import { setProductStatusAction } from "@/app/actions/admin-catalogue";
import { DatabaseRequired, Notice, PageHeader, Pagination, StatusBadge, tableClasses } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { getCatalogueOptions, listProducts } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Products" };

type SearchParams = Promise<{ q?: string; status?: string; categoryId?: string; page?: string; saved?: string; failed?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAdmin();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-6xl gap-6"><PageHeader title="Products" /><DatabaseRequired /></div>;
  const [{ items, total, page, pages }, { categories }] = await Promise.all([
    listProducts({ q: sp.q, status: sp.status, categoryId: sp.categoryId, page: Number(sp.page) || 1 }),
    getCatalogueOptions(),
  ]);
  const owner = session.role === "OWNER";

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title="Products"
        intro="Add and edit products. Only Active products appear on the website, and the website never shows prices."
        actions={<ButtonLink href="/admin/products/new">Add product</ButtonLink>}
      />
      {sp.saved && <Notice kind="success">Saved.</Notice>}
      {sp.failed && <Notice kind="error">That change could not be made. Please try again.</Notice>}

      <form method="get" role="search" aria-label="Filter products" className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-[1fr_11rem_14rem_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">Search</label>
          <input id="q" name="q" defaultValue={sp.q} maxLength={80} placeholder="Name, SKU or web address" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-semibold">Category</label>
          <select id="categoryId" name="categoryId" defaultValue={sp.categoryId ?? ""} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900">Filter</button>
      </form>

      {items.length === 0 ? (
        <Notice kind="info">{total === 0 && !sp.q && !sp.status && !sp.categoryId ? "No products yet. Add the first one." : "No products match."}</Notice>
      ) : (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Products ({total})</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Product</th>
                <th scope="col" className={tableClasses.th}>Category / brand</th>
                <th scope="col" className={tableClasses.th}>SKU</th>
                <th scope="col" className={tableClasses.th}>Stock</th>
                {owner && <th scope="col" className={tableClasses.th}>Wholesale ₹</th>}
                <th scope="col" className={tableClasses.th}>Status</th>
                <th scope="col" className={tableClasses.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}>
                    <Link href={`/admin/products/${p.id}`} className="text-brand-800 hover:underline">{p.name}</Link>
                  </th>
                  <td className={tableClasses.td}>{p.categoryName}{p.brandName ? ` · ${p.brandName}` : ""}</td>
                  <td className={tableClasses.td}>{p.sku ?? <span className="text-muted">—</span>}</td>
                  <td className={tableClasses.td}>{p.stockQuantity ?? <span className="text-muted">not tracked</span>}</td>
                  {owner && <td className={tableClasses.td}>{p.wholesalePrice ?? <span className="text-muted">—</span>}</td>}
                  <td className={tableClasses.td}><StatusBadge status={p.status} /></td>
                  <td className={tableClasses.td}>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/products/${p.id}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">Edit<span className="sr-only"> {p.name}</span></Link>
                      {p.status === "ACTIVE" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "INACTIVE")}>
                          <button type="submit" className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-50">Deactivate<span className="sr-only"> {p.name}</span></button>
                        </form>
                      ) : (
                        <form action={setProductStatusAction.bind(null, p.id, "ACTIVE")}>
                          <button type="submit" className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Publish<span className="sr-only"> {p.name}</span></button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} basePath="/admin/products" params={{ q: sp.q, status: sp.status, categoryId: sp.categoryId }} />
    </div>
  );
}
