import type { Metadata } from "next";
import { Backlink } from "@/components/admin/backlink";
import { PicturesTool } from "@/components/admin/pictures-tool";
import { DatabaseRequired, Notice, PageHeader } from "@/components/admin/ui";
import { listProductsForPictures } from "@/lib/admin/catalogue-admin";
import { requireAdmin } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { isStorageConfigured } from "@/lib/storage/supabase-storage";

export const metadata: Metadata = { title: "Add many pictures" };

export default async function BulkPicturesPage() {
  await requireAdmin();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const products = await listProductsForPictures();
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Backlink href="/admin/products">Products</Backlink>
      <PageHeader title="Add many pictures" intro="Name each picture file after its product, choose them all at once, and check the list before uploading." />
      <section aria-labelledby="how" className="rounded-xl border border-line bg-white p-5">
        <h2 id="how" className="text-lg font-extrabold">How the files are matched</h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">
          <li>The file name (without .jpg / .png / .webp) must be the product&apos;s <strong>web address</strong> (slug) or its <strong>SKU</strong>. <code>blue-pen.jpg</code> goes to the product <code>blue-pen</code>.</li>
          <li>Spaces and capitals are fine: <code>Blue Pen.JPG</code> also matches <code>blue-pen</code>.</li>
          <li>You can see each product&apos;s web address on its page under <em>Products</em>.</li>
          <li>The description of each picture is the product&apos;s name.</li>
        </ul>
      </section>
      {!isStorageConfigured() ? (
        <Notice kind="info">Picture storage is not set up yet, so pictures can not be uploaded. Follow docs/PHOTOS.md (a few minutes in Supabase and Vercel).</Notice>
      ) : products.length === 0 ? (
        <Notice kind="info">There are no products yet. Add or import products first.</Notice>
      ) : (
        <PicturesTool products={products} />
      )}
    </div>
  );
}
