import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const getPicture = vi.fn();
const setPicture = vi.fn();
const clearPicture = vi.fn();
const upload = vi.fn();
const del = vi.fn();
let configured = true;
let storage: { baseUrl: string; key: string; bucket: string } | null = { baseUrl: "https://abc.supabase.co", key: "k", bucket: "product-images" };

vi.mock("@/lib/auth/guard", () => ({ getAdminSession: () => session() }));
vi.mock("@/lib/db/client", () => ({ isDatabaseConfigured: () => configured }));
vi.mock("@/lib/admin/catalogue-admin", () => ({ getProductPicture: (...a: unknown[]) => getPicture(...a), setProductPicture: (...a: unknown[]) => setPicture(...a), clearProductPicture: (...a: unknown[]) => clearPicture(...a) }));
vi.mock("@/lib/storage/supabase-storage", async () => {
  const real = await vi.importActual<typeof import("@/lib/storage/supabase-storage")>("@/lib/storage/supabase-storage");
  return { ...real, getStorageConfig: () => storage, uploadObject: (...a: unknown[]) => upload(...a), deleteObject: (...a: unknown[]) => del(...a) };
});

const { POST, DELETE } = await import("@/app/api/admin/product-image/route");

const jpeg = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#2255aa" } }).jpeg().toBuffer();

async function postRequest(opts: { origin?: string | null; file?: Buffer | null; fileName?: string; alt?: string; productId?: string; contentLength?: number | null } = {}) {
  const form = new FormData();
  form.set("productId", opts.productId ?? "cmprod1");
  form.set("alt", opts.alt ?? "Blue pen, box of 10");
  if (opts.file !== null) form.set("file", new File([new Uint8Array(opts.file ?? (await jpeg()))], opts.fileName ?? "pen.jpg", { type: "image/jpeg" }));
  const body = new Response(form);
  const buffer = Buffer.from(await body.arrayBuffer());
  const headers: Record<string, string> = { host: "shop.example.in", "content-type": body.headers.get("content-type")! };
  if (opts.origin !== null) headers.origin = opts.origin ?? "https://shop.example.in";
  if (opts.contentLength !== null) headers["content-length"] = String(opts.contentLength ?? buffer.length);
  return new Request("https://shop.example.in/api/admin/product-image", { method: "POST", headers, body: buffer });
}

beforeEach(() => {
  vi.clearAllMocks();
  configured = true;
  storage = { baseUrl: "https://abc.supabase.co", key: "k", bucket: "product-images" };
  session.mockResolvedValue({ userId: "u", role: "OWNER" });
  getPicture.mockResolvedValue({ name: "Pen", imageUrl: null, imagePath: null, imageAlt: null });
  setPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: null });
  clearPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: null });
  upload.mockResolvedValue(undefined);
  del.mockResolvedValue(true);
});

describe("POST /api/admin/product-image", () => {
  it("refuses a request from another site, or with no Origin, before doing anything", async () => {
    for (const origin of ["https://evil.example", "null", null]) {
      const response = await POST(await postRequest({ origin }));
      expect(response.status, String(origin)).toBe(403);
    }
    expect(session).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not signed in, and answers 503 when storage or the database is not set up", async () => {
    session.mockResolvedValue(null);
    expect((await POST(await postRequest())).status).toBe(401);
    session.mockResolvedValue({ userId: "u" });
    storage = null;
    expect((await POST(await postRequest())).status).toBe(503);
    configured = false;
    expect((await POST(await postRequest())).status).toBe(503);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses an upload with no declared length, or one that declares more than the limit, without reading it", async () => {
    expect((await POST(await postRequest({ contentLength: null }))).status).toBe(411);
    expect((await POST(await postRequest({ contentLength: 9 * 1024 * 1024 }))).status).toBe(413);
    expect(getPicture).not.toHaveBeenCalled();
  });

  it("needs a product, a picture and a description", async () => {
    expect((await POST(await postRequest({ file: null }))).status).toBe(400);
    const noAlt = await POST(await postRequest({ alt: "  " }));
    expect(noAlt.status).toBe(422);
    expect(await noAlt.json()).toMatchObject({ field: "imageAlt" });
    getPicture.mockResolvedValue(null);
    expect((await POST(await postRequest())).status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file that is not really a picture, however it is named", async () => {
    const response = await POST(await postRequest({ file: Buffer.from("<svg onload=alert(1)>"), fileName: "pen.jpg" }));
    expect(response.status).toBe(422);
    expect(upload).not.toHaveBeenCalled();
    expect(setPicture).not.toHaveBeenCalled();
  });

  it("stores a re-encoded WebP under a new random path, records it, and deletes the old file", async () => {
    setPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: "products/cmprod1/0123456789abcdef.webp" });
    const response = await POST(await postRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, width: 640, height: 480 });
    const [, path, data] = upload.mock.calls[0] as [unknown, string, Buffer];
    expect(path).toMatch(/^products\/cmprod1\/[a-f0-9]{16}\.webp$/);
    expect((await sharp(data).metadata()).format).toBe("webp");
    expect(setPicture).toHaveBeenCalledWith("cmprod1", expect.objectContaining({ imagePath: path, imageUrl: `https://abc.supabase.co/storage/v1/object/public/product-images/${path}`, imageAlt: "Blue pen, box of 10" }));
    expect(del).toHaveBeenCalledWith(expect.anything(), "products/cmprod1/0123456789abcdef.webp");
  });

  it("never deletes a previous path that is not one of ours", async () => {
    setPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: "../../somebody/else.webp" });
    await POST(await postRequest());
    expect(del).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded file when the database write fails, and reports a storage outage", async () => {
    setPicture.mockResolvedValue({ ok: false, message: "Could not save. Please try again." });
    const failed = await POST(await postRequest());
    expect(failed.status).toBe(500);
    expect(del).toHaveBeenCalledWith(expect.anything(), (upload.mock.calls[0] as [unknown, string])[1]);
    upload.mockRejectedValue(new Error("Storage upload failed with HTTP 500"));
    const down = await POST(await postRequest());
    expect(down.status).toBe(502);
    expect(JSON.stringify(await down.json())).not.toContain("HTTP 500");
  });
});

describe("DELETE /api/admin/product-image", () => {
  const request = (query = "?productId=cmprod1", origin: string | null = "https://shop.example.in") =>
    new Request(`https://shop.example.in/api/admin/product-image${query}`, { method: "DELETE", headers: { host: "shop.example.in", ...(origin ? { origin } : {}) } });

  it("needs the same origin and a signed-in admin", async () => {
    expect((await DELETE(request("?productId=x", "https://evil.example"))).status).toBe(403);
    session.mockResolvedValue(null);
    expect((await DELETE(request())).status).toBe(401);
    expect(clearPicture).not.toHaveBeenCalled();
  });

  it("clears the record and deletes only our own file", async () => {
    clearPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: "products/cmprod1/0123456789abcdef.webp" });
    expect((await DELETE(request())).status).toBe(200);
    expect(del).toHaveBeenCalledWith(expect.anything(), "products/cmprod1/0123456789abcdef.webp");
    del.mockClear();
    clearPicture.mockResolvedValue({ ok: true, id: "cmprod1", previousPath: "/public/images/products/x.jpg" });
    await DELETE(request());
    expect(del).not.toHaveBeenCalled();
    expect((await DELETE(request(""))).status).toBe(400);
  });
});
