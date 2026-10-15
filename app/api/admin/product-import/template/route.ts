import { IMPORT_COLUMNS } from "@/lib/admin/product-import";
import { getAdminSession } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

/** The empty template: the header row only. No example product — nothing is invented. */
export async function GET() {
  if (!isDatabaseConfigured() || !(await getAdminSession())) return new Response("Not found", { status: 404 });
  return new Response(`${IMPORT_COLUMNS.join(",")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="products-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
