import { NextResponse } from "next/server";
import { clearProductPicture, getProductPicture, setProductPicture } from "@/lib/admin/catalogue-admin";
import { getAdminSession } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { MAX_UPLOAD_BYTES, processProductImage } from "@/lib/storage/process-image";
import { deleteObject, getStorageConfig, newObjectPath, ownObjectPath, publicUrlFor, uploadObject } from "@/lib/storage/supabase-storage";
import { imageAltSchema } from "@/lib/validation/admin-catalogue";

/**
 * Upload / remove a product picture.
 *
 * This is a route handler rather than a server action because pictures are far larger than the 128 KB cap the server
 * actions keep for the public forms. It therefore does its own checks, in this order, before reading any of the body:
 *   1. same-origin request (a page on another site can not make an admin's browser upload),
 *   2. a signed-in admin,
 *   3. a declared size within the limit.
 * Then the file is decoded and re-encoded (lib/storage/process-image.ts) — nothing the browser sent is stored as is.
 */
export const runtime = "nodejs";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // browsers always send Origin on a cross-origin or form POST; refuse when it is missing
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function gate(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request refused." }, 403);
  if (!isDatabaseConfigured()) return json({ error: "The database is not connected." }, 503);
  if (!(await getAdminSession())) return json({ error: "Please sign in again." }, 401);
  return null;
}

export async function POST(request: Request) {
  const refused = await gate(request);
  if (refused) return refused;

  const config = getStorageConfig();
  if (!config) return json({ error: "Picture storage is not set up yet. See docs/PHOTOS.md." }, 503);

  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return json({ error: "Request refused." }, 411);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "That picture is larger than 8 MB." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "That upload could not be read." }, 400);
  }
  const productId = form.get("productId");
  const file = form.get("file");
  const altRaw = form.get("alt");
  if (typeof productId !== "string" || !productId || productId.length > 60) return json({ error: "Missing product." }, 400);
  if (!(file instanceof File)) return json({ error: "Choose a picture first." }, 400);
  const alt = imageAltSchema.safeParse(typeof altRaw === "string" ? altRaw : "");
  if (!alt.success) return json({ error: alt.error.issues[0]?.message ?? "Describe the picture.", field: "imageAlt" }, 422);

  const product = await getProductPicture(productId);
  if (!product) return json({ error: "That product no longer exists." }, 404);

  const processed = await processProductImage(Buffer.from(await file.arrayBuffer()));
  if (!processed.ok) return json({ error: processed.message, field: "file" }, 422);

  const objectPath = newObjectPath(productId);
  try {
    await uploadObject(config, objectPath, processed.data);
  } catch (error) {
    console.error("[product-image] upload failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "The picture could not be stored. Please try again." }, 502);
  }

  const saved = await setProductPicture(productId, { imageUrl: publicUrlFor(config, objectPath), imagePath: objectPath, imageAlt: alt.data });
  if (!saved.ok) {
    await deleteObject(config, objectPath); // do not leave an orphan file behind
    return json({ error: saved.message }, 500);
  }
  const previous = ownObjectPath(saved.previousPath);
  if (previous) await deleteObject(config, previous);
  return json({ ok: true, width: processed.width, height: processed.height, kilobytes: Math.round(processed.bytes / 1024) });
}

export async function DELETE(request: Request) {
  const refused = await gate(request);
  if (refused) return refused;
  const productId = new URL(request.url).searchParams.get("productId") ?? "";
  if (!productId || productId.length > 60) return json({ error: "Missing product." }, 400);

  const cleared = await clearProductPicture(productId);
  if (!cleared.ok) return json({ error: cleared.message }, 404);
  const config = getStorageConfig();
  const previous = ownObjectPath(cleared.previousPath);
  if (config && previous) await deleteObject(config, previous);
  return json({ ok: true });
}
