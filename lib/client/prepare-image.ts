/**
 * Runs in the BROWSER, before a picture is uploaded: shrinks it to at most 1600 px on the long side and saves it as a
 * WebP (or JPEG where WebP is not available).
 *
 * Why: the hosting platform refuses any single request bigger than 4.5 MB, and phone or AI-made pictures are often
 * 5–15 MB. Shrinking first makes every picture a few hundred KB, so uploads are fast and never hit that limit. The
 * server still decodes and re-encodes whatever arrives (lib/storage/process-image.ts), so this is a convenience, not a
 * security check. A side effect: hidden camera data (location) never even leaves the computer.
 */
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024; // sanity cap on what the browser is asked to decode
export const MAX_SEND_BYTES = 4 * 1024 * 1024; // safely under the platform's 4.5 MB request limit
const MAX_SIDE = 1600;

export type Prepared = { ok: true; file: File; shrunk: boolean } | { ok: false; message: string };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<Prepared> {
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, message: "That picture is larger than 30 MB. Take it again at a lower quality." };
  try {
    const bitmap = await createImageBitmap(file); // applies the camera's orientation in current browsers
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.fillStyle = "#ffffff"; // transparent pictures become white, like a product shot
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let blob = await toBlob(canvas, "image/webp", 0.86);
    let extension = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", 0.88);
      extension = "jpg";
    }
    if (!blob) throw new Error("no blob");
    if (blob.size > MAX_SEND_BYTES) return { ok: false, message: "That picture is still too large after shrinking. Try a smaller one." };
    const name = file.name.replace(/\.[^.]+$/, "") + "." + extension;
    return { ok: true, file: new File([blob], name, { type: blob.type }), shrunk: true };
  } catch {
    // Not a picture this browser can read (for example a HEIC photo): send it as it is if it is small enough, and let
    // the server decide.
    if (file.size <= MAX_SEND_BYTES) return { ok: true, file, shrunk: false };
    return { ok: false, message: "This browser can not read that picture, and it is too large to send as it is. Save it as a JPG or PNG and try again." };
  }
}

/** A readable reason for a failed upload, even when the server's answer was not JSON (a platform error page). */
export function uploadFailureMessage(status: number, serverMessage: string | undefined): string {
  if (serverMessage) return serverMessage;
  if (status === 413) return "The picture is too large for the server.";
  if (status === 504 || status === 408) return "The server took too long. Try again.";
  return `The server could not save it (error ${status}). Try again; if it keeps failing, tell the person who looks after the website.`;
}
