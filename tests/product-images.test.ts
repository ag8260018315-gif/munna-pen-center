import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SIDE_PX, MAX_UPLOAD_BYTES, processProductImage } from "@/lib/storage/process-image";
import { deleteObject, newObjectPath, ownObjectPath, publicUrlFor, uploadObject, type StorageConfig } from "@/lib/storage/supabase-storage";

const jpeg = (w = 400, h = 300) => sharp({ create: { width: w, height: h, channels: 3, background: "#cc3333" } }).jpeg().toBuffer();

describe("processProductImage", () => {
  it("turns a JPEG into a WebP no bigger than 1200px, keeping the aspect ratio", async () => {
    const result = await processProductImage(await jpeg(3000, 1500));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ width: MAX_SIDE_PX, height: 600 });
    expect((await sharp(result.data).metadata()).format).toBe("webp");
  });

  it("does not enlarge a small picture", async () => {
    const result = await processProductImage(await jpeg(200, 100));
    expect(result).toMatchObject({ ok: true, width: 200, height: 100 });
  });

  it("accepts PNG and WebP, and puts transparency on white", async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const result = await processProductImage(png);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = await sharp(result.data).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
    expect((await processProductImage(await sharp(png).webp().toBuffer())).ok).toBe(true);
  });

  it("removes hidden data such as the GPS position, and applies the camera orientation", async () => {
    const tagged = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#336699" } })
      .withExif({ IFD0: { Copyright: "secret-shop" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "23/1 48/1 0/1" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    const result = await processProductImage(tagged);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const out = await sharp(result.data).metadata();
    expect(out.exif).toBeUndefined();
    expect(out.orientation).toBeUndefined();
    expect(result.data.includes(Buffer.from("secret-shop"))).toBe(false);
    expect([result.width, result.height]).toEqual([100, 200]); // rotated upright
  });

  it("refuses anything that is not a real JPEG/PNG/WebP — whatever it is called", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).gif().toBuffer();
    const cases: [string, Buffer][] = [
      ["svg", svg],
      ["gif", gif],
      ["html", Buffer.from("<html><script>alert(1)</script></html>")],
      ["text", Buffer.from("hello")],
      ["empty", Buffer.alloc(0)],
      ["truncated jpeg", (await jpeg()).subarray(0, 50)],
      ["pdf", Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n")],
    ];
    for (const [name, buffer] of cases) {
      const result = await processProductImage(buffer);
      expect(result.ok, name).toBe(false);
    }
  });

  it("refuses an animation and a file over the size limit", async () => {
    const frame = (background: string) => sharp({ create: { width: 10, height: 10, channels: 3, background } }).png().toBuffer();
    const animated = await sharp([await frame("#f00"), await frame("#00f")], { join: { animated: true } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    expect(await processProductImage(animated)).toMatchObject({ ok: false });
    expect(await processProductImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toMatchObject({ ok: false, message: expect.stringContaining("8 MB") });
  });

  it("refuses a decompression bomb (huge dimensions, tiny file)", async () => {
    const bomb = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(await processProductImage(bomb)).toMatchObject({ ok: false });
  });
});

describe("supabase storage client", () => {
  const config: StorageConfig = { baseUrl: "https://abc.supabase.co", key: "service-key-value", bucket: "product-images" };
  afterEach(() => vi.unstubAllGlobals());

  it("builds unguessable, safe object paths and public URLs", () => {
    const a = newObjectPath("cmabc123");
    expect(a).toMatch(/^products\/cmabc123\/[a-f0-9]{16}\.webp$/);
    expect(newObjectPath("cmabc123")).not.toBe(a);
    expect(newObjectPath("../../etc/passwd")).toMatch(/^products\/etcpasswd\//);
    expect(publicUrlFor(config, a)).toBe(`https://abc.supabase.co/storage/v1/object/public/product-images/${a}`);
  });

  it("only ever deletes paths that look like ones this system made", () => {
    expect(ownObjectPath("products/cmabc123/0123456789abcdef.webp")).not.toBeNull();
    for (const bad of ["../x.webp", "products/../../x/0123456789abcdef.webp", "other/cm/0123456789abcdef.webp", "products/cm/x.png", "", null, undefined]) {
      expect(ownObjectPath(bad as never), String(bad)).toBeNull();
    }
  });

  it("uploads with the service key in headers only, never in the URL, and does not overwrite", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await uploadObject(config, "products/cm1/0123456789abcdef.webp", Buffer.from("x"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://abc.supabase.co/storage/v1/object/product-images/products/cm1/0123456789abcdef.webp");
    expect(url).not.toContain("service-key-value");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer service-key-value", "Content-Type": "image/webp", "x-upsert": "false" });
  });

  it("reports a failed upload without echoing the key or the response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied service-key-value", { status: 403 })));
    const error = await uploadObject(config, "products/cm1/0123456789abcdef.webp", Buffer.from("x")).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Storage upload failed with HTTP 403");
  });

  it("treats delete as best effort: a missing object is fine, an outage never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    expect(await deleteObject(config, "products/cm1/0123456789abcdef.webp")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await deleteObject(config, "products/cm1/0123456789abcdef.webp")).toBe(false);
  });
});
