import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Backlink } from "@/components/admin/backlink";
import { ImportTool } from "@/components/admin/import-tool";
import { DatabaseRequired, PageHeader, tableClasses } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { listCategories, listBrands } from "@/lib/admin/catalogue-admin";
import { MAX_IMPORT_ROWS } from "@/lib/admin/product-import";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Import products" };

const COLUMNS: { name: string; note: string; ownerOnly?: boolean; required?: boolean }[] = [
  { name: "name", note: "Product name.", required: true },
  { name: "category", note: "Must already exist: type its name exactly as under Categories.", required: true },
  { name: "brand", note: "Optional. Must already exist under Brands." },
  { name: "short_description", note: "One line shown in lists." },
  { name: "description", note: "Longer text." },
  { name: "unit", note: "e.g. piece, box, dozen." },
  { name: "pack_size", note: "e.g. Box of 10." },
  { name: "sku", note: "Your own code. Must not be used by another product." },
  { name: "min_order_quantity", note: "Whole number, 1 or more." },
  { name: "stock", note: "Whole number. Empty = stock not tracked; 0 = out of stock." },
  { name: "tags", note: "Words separated by ; or | (or commas inside quotes)." },
  { name: "status", note: "DRAFT (hidden, the default), ACTIVE (shown on the website) or INACTIVE." },
  { name: "featured", note: "yes / no." },
  { name: "slug", note: "Web address. Leave empty to make it from the name." },
  { name: "purchase_price", note: "Rupees, up to 2 decimals.", ownerOnly: true },
  { name: "wholesale_price", note: "Rupees, up to 2 decimals.", ownerOnly: true },
  { name: "retail_price", note: "Rupees, up to 2 decimals.", ownerOnly: true },
  { name: "gst_percent", note: "0 to 100.", ownerOnly: true },
  { name: "hsn_code", note: "4 to 8 digits.", ownerOnly: true },
];

export default async function ImportProductsPage() {
  const session = await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [categories, brands] = await Promise.all([listCategories(), listBrands()]);
  const owner = session.role === "OWNER";
  return (
    <div className="mx-auto grid max-w-4xl gap-8">
      <Backlink href="/admin/products">Products</Backlink>
      <PageHeader title="Import products from a spreadsheet" intro={`Add up to ${MAX_IMPORT_ROWS} products at once. Nothing is saved until the whole file has been checked and you press Import.`} />

      <section aria-labelledby="steps" className="grid gap-3 rounded-xl border border-line bg-white p-5">
        <h2 id="steps" className="text-lg font-extrabold">Steps</h2>
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
          <li>Download the empty template and open it in Excel or Google Sheets.</li>
          <li>Add one product per row. Leave a cell empty if you do not know the value — it stays “not entered”. Nothing is filled in for you.</li>
          <li>Save as <strong>CSV (comma separated, UTF-8)</strong>.</li>
          <li>Choose the file below, press <em>Check the file</em>, fix anything it lists, then press <em>Import</em>.</li>
          <li>Afterwards add pictures with <Link className="font-semibold text-brand-800 underline" href="/admin/products/pictures">Add many pictures</Link>.</li>
        </ol>
        <div>
          <a href="/api/admin/product-import/template" className={buttonStyles({ variant: "secondary" })} download>
            <Download className="size-4" aria-hidden="true" /> Download the template
          </a>
        </div>
      </section>

      <section aria-labelledby="tool" className="grid gap-4 rounded-xl border border-line bg-white p-5">
        <h2 id="tool" className="text-lg font-extrabold">Check and import</h2>
        <ImportTool />
      </section>

      <section aria-labelledby="columns">
        <h2 id="columns" className="text-lg font-extrabold">The columns</h2>
        <p className="mt-1 text-sm text-muted">Keep the header row exactly as in the template. A column name this page does not know is refused, so a typo can never silently drop a price.{!owner && " Columns marked owner can only be filled by the owner."}</p>
        <div className={`${tableClasses.wrap} mt-3`}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Columns of the products spreadsheet</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>Column</th>
                <th scope="col" className={tableClasses.th}>What to put</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}><code>{c.name}</code>{c.required && <span className="ml-2 text-xs font-bold text-red-700">required</span>}{c.ownerOnly && <span className="ml-2 text-xs font-bold text-amber-900">owner</span>}</th>
                  <td className={tableClasses.td}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="names" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 id="names" className="text-lg font-extrabold">Your categories</h2>
          <p className="mt-1 text-sm text-muted">Use these names in the <code>category</code> column.</p>
          <ul className="mt-3 grid max-h-72 gap-1 overflow-y-auto text-sm" tabIndex={0} aria-label="Category names">
            {categories.length === 0 ? <li className="text-muted">No categories yet.</li> : categories.map((c) => <li key={c.id}>{c.name}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-extrabold">Your brands</h2>
          <p className="mt-1 text-sm text-muted">Use these names in the <code>brand</code> column.</p>
          <ul className="mt-3 grid max-h-72 gap-1 overflow-y-auto text-sm" tabIndex={0} aria-label="Brand names">
            {brands.length === 0 ? <li className="text-muted">No brands yet.</li> : brands.map((b) => <li key={b.id}>{b.name}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
