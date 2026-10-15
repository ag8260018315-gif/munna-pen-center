import { importProducts, MAX_IMPORT_BYTES, previewProductImport } from "@/lib/admin/product-import";
import { adminApiGate, json } from "@/lib/auth/api-gate";

/**
 * Check or import a products spreadsheet (CSV). A route handler rather than a server action because a spreadsheet is
 * bigger than the 128 KB cap the server actions keep for the public forms. Same gate as the picture upload
 * (lib/auth/api-gate.ts), a size limit before the body is read, and the file is only ever read as text.
 *
 * multipart fields: `file` (the CSV) and `mode` = "check" | "import".
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const refused = await adminApiGate(request);
  if (refused) return refused;

  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return json({ error: "Request refused." }, 411);
  if (declared > MAX_IMPORT_BYTES + 16 * 1024) return json({ error: "That file is larger than 1 MB. Split it into smaller files." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "That upload could not be read." }, 400);
  }
  const file = form.get("file");
  const mode = form.get("mode");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a CSV file first." }, 400);
  if (file.size > MAX_IMPORT_BYTES) return json({ error: "That file is larger than 1 MB. Split it into smaller files." }, 413);
  if (mode !== "check" && mode !== "import") return json({ error: "Unknown request." }, 400);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return json({ error: "The file is not UTF-8 text. In Excel or Google Sheets save it as “CSV UTF-8”." }, 422);
  }

  if (mode === "check") return json({ mode, ...(await previewProductImport(text)) });
  const result = await importProducts(text);
  return json({ mode, ...result }, result.ok ? 200 : 422);
}
