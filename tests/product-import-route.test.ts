import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const preview = vi.fn();
const doImport = vi.fn();
let configured = true;

vi.mock("@/lib/auth/guard", () => ({ getAdminSession: () => session() }));
vi.mock("@/lib/db/client", () => ({ isDatabaseConfigured: () => configured }));
vi.mock("@/lib/admin/product-import", () => ({
  MAX_IMPORT_BYTES: 1024 * 1024,
  IMPORT_COLUMNS: ["name", "category"],
  previewProductImport: (...a: unknown[]) => preview(...a),
  importProducts: (...a: unknown[]) => doImport(...a),
}));

const { POST } = await import("@/app/api/admin/product-import/route");
const { GET: template } = await import("@/app/api/admin/product-import/template/route");

async function req(opts: { origin?: string | null; file?: Uint8Array | null; mode?: string; contentLength?: number | null } = {}) {
  const form = new FormData();
  if (opts.file !== null) form.set("file", new File([new Uint8Array(opts.file ?? new TextEncoder().encode("name,category\nPen,Pens\n"))], "p.csv", { type: "text/csv" }));
  if (opts.mode !== "") form.set("mode", opts.mode ?? "check");
  const body = new Response(form);
  const buffer = Buffer.from(await body.arrayBuffer());
  const headers: Record<string, string> = { host: "shop.example.in", "content-type": body.headers.get("content-type")! };
  if (opts.origin !== null) headers.origin = opts.origin ?? "https://shop.example.in";
  if (opts.contentLength !== null) headers["content-length"] = String(opts.contentLength ?? buffer.length);
  return new Request("https://shop.example.in/api/admin/product-import", { method: "POST", headers, body: buffer });
}

beforeEach(() => {
  vi.clearAllMocks();
  configured = true;
  session.mockResolvedValue({ userId: "u", role: "OWNER" });
  preview.mockResolvedValue({ ok: true, total: 1, rows: [] });
  doImport.mockResolvedValue({ ok: true, created: 1 });
});

describe("POST /api/admin/product-import", () => {
  it("refuses other sites, signed-out visitors and a missing database before reading anything", async () => {
    for (const origin of ["https://evil.example", null]) expect((await POST(await req({ origin }))).status).toBe(403);
    session.mockResolvedValue(null);
    expect((await POST(await req())).status).toBe(401);
    session.mockResolvedValue({ userId: "u" });
    configured = false;
    expect((await POST(await req())).status).toBe(503);
    expect(preview).not.toHaveBeenCalled();
    expect(doImport).not.toHaveBeenCalled();
  });

  it("refuses a missing or oversized declared length, an empty file and an unknown mode", async () => {
    expect((await POST(await req({ contentLength: null }))).status).toBe(411);
    expect((await POST(await req({ contentLength: 5 * 1024 * 1024 }))).status).toBe(413);
    expect((await POST(await req({ file: null }))).status).toBe(400);
    expect((await POST(await req({ mode: "delete" }))).status).toBe(400);
    expect((await POST(await req({ mode: "" }))).status).toBe(400);
    expect(preview).not.toHaveBeenCalled();
  });

  it("refuses a file that is not UTF-8 text (so binary files and wrong encodings never reach the parser)", async () => {
    const response = await POST(await req({ file: new Uint8Array([0x6e, 0x61, 0xff, 0xfe, 0xfa]) }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("UTF-8") });
    expect(preview).not.toHaveBeenCalled();
  });

  it("'check' only previews; 'import' imports; both get the file as text", async () => {
    const checked = await POST(await req({ mode: "check" }));
    expect(checked.status).toBe(200);
    expect(await checked.json()).toMatchObject({ mode: "check", ok: true, total: 1 });
    expect(preview).toHaveBeenCalledWith("name,category\nPen,Pens\n");
    expect(doImport).not.toHaveBeenCalled();
    const imported = await POST(await req({ mode: "import" }));
    expect(await imported.json()).toMatchObject({ mode: "import", ok: true, created: 1 });
    expect(doImport).toHaveBeenCalledOnce();
  });

  it("answers 422 when the import is refused, with the problems", async () => {
    doImport.mockResolvedValue({ ok: false, message: "Some rows need fixing.", problems: [{ line: 3, messages: ["Category is empty."] }] });
    const response = await POST(await req({ mode: "import" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ ok: false, problems: [{ line: 3 }] });
  });
});

describe("GET /api/admin/product-import/template", () => {
  it("is for signed-in admins only and contains just the header row", async () => {
    session.mockResolvedValue(null);
    expect((await template()).status).toBe(404);
    session.mockResolvedValue({ userId: "u" });
    const response = await template();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toBe("name,category\r\n");
  });
});
