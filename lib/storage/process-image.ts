import "server-only";
import sharp from "sharp";

/**
 * Turns an uploaded picture into a safe, small WebP.
 *
 *  • The file TYPE is decided by decoding it, never by the name or the browser's claim: only real JPEG, PNG and WebP
 *    pictures pass (so SVG — which can carry scripts — GIF, HTML and renamed files are all refused).
 *  • Phone photos carry hidden data (often GPS position of the shop or home). Re-encoding drops all of it; the
 *    orientation is applied first so the picture is not left sideways.
 *  • Pictures are shrunk to at most 1200 px on the long side, and a decompression-bomb cap refuses absurd dimensions.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // the file as sent
export const MAX_SIDE_PX = 1200;
const MAX_INPUT_PIXELS = 40_000_000; // ~40 megapixels
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type ProcessedImage = { ok: true; data: Buffer; width: number; height: number; bytes: number } | { ok: false; message: string };

export async function processProductImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) return { ok: false, message: "That file is empty." };
  if (input.length > MAX_UPLOAD_BYTES) return { ok: false, message: "That picture is larger than 8 MB. Take it again at a lower quality, or send a smaller one." };
  try {
    const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await source.metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) return { ok: false, message: "Use a JPG, PNG or WebP picture." };
    if (!meta.width || !meta.height) return { ok: false, message: "That picture could not be read." };
    if ((meta.pages ?? 1) > 1) return { ok: false, message: "Use a single still picture, not an animation." };

    const { data, info } = await source
      .rotate() // apply the camera's orientation, then the tag is dropped with the rest of the metadata
      .resize({ width: MAX_SIDE_PX, height: MAX_SIDE_PX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // transparent PNGs become white, like a product shot
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, data, width: info.width, height: info.height, bytes: data.length };
  } catch {
    return { ok: false, message: "That file is not a picture we can read. Use a JPG, PNG or WebP." };
  }
}
