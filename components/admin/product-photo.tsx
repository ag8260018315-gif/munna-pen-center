"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 8 * 1024 * 1024;

interface Props {
  productId: string;
  productName: string;
  imageUrl: string | null;
  imageAlt: string | null;
  storageReady: boolean;
}

/** Upload, replace or remove a product's picture. The server re-encodes it (JPG/PNG/WebP in, small WebP out). */
export function ProductPhoto({ productId, productName, imageUrl, imageAlt, storageReady }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ file?: string; imageAlt?: string }>({});

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const errors: typeof fieldErrors = {};
    if (!(file instanceof File) || file.size === 0) errors.file = "Choose a picture first";
    else if (file.size > MAX_BYTES) errors.file = "That picture is larger than 8 MB";
    if (String(data.get("alt") ?? "").trim().length < 3) errors.imageAlt = "Describe the picture in a few words";
    setFieldErrors(errors);
    if (errors.file || errors.imageAlt) return;

    data.set("productId", productId);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/product-image", { method: "POST", body: data });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: string; kilobytes?: number };
      if (!response.ok) {
        if (result.field === "file" || result.field === "imageAlt") setFieldErrors({ [result.field]: result.error });
        setMessage({ kind: "error", text: result.error ?? "The picture could not be saved." });
        return;
      }
      setMessage({ kind: "success", text: `Picture saved (${result.kilobytes} KB). It is on the website now.` });
      form.reset();
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "The upload did not go through. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this picture from the website?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/product-image?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setMessage({ kind: "success", text: "Picture removed." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "The picture could not be removed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="photo-title" className="grid gap-4 rounded-xl border border-line bg-white p-5">
      <h2 id="photo-title" className="text-lg font-extrabold">Picture</h2>
      {!storageReady && (
        <Notice kind="info">Picture storage is not set up yet, so pictures can not be uploaded. Follow docs/PHOTOS.md (a few minutes in Supabase and Vercel).</Notice>
      )}
      <div className="flex flex-wrap items-start gap-5">
        {imageUrl ? (
          <Image src={imageUrl} alt={imageAlt ?? productName} width={200} height={200} unoptimized className="size-48 rounded-lg border border-line bg-brand-50 object-contain p-2" />
        ) : (
          <p className="grid size-48 place-items-center rounded-lg border border-dashed border-slate-400 p-4 text-center text-sm text-muted">No picture yet. The website shows a neutral icon.</p>
        )}
        {imageUrl && (
          <div className="grid gap-2">
            <p className="text-sm text-muted">Description: {imageAlt}</p>
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={remove} disabled={busy || !storageReady}>
                Remove picture
              </Button>
            </div>
          </div>
        )}
      </div>

      {storageReady && (
        <form onSubmit={upload} aria-busy={busy} className="grid gap-4" noValidate>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <div>
            <label htmlFor="photo-file" className="mb-1.5 block text-sm font-semibold">
              {imageUrl ? "Replace with a new picture" : "Choose a picture"} <span className="text-red-700" aria-hidden="true">*</span>
            </label>
            <input
              id="photo-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={fieldErrors.file ? true : undefined}
              aria-describedby={fieldErrors.file ? "photo-file-error" : "photo-file-hint"}
              className="block w-full max-w-md text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:font-semibold"
            />
            <p id="photo-file-hint" className="mt-1.5 text-sm text-muted">JPG, PNG or WebP, up to 8 MB. A clear photo on a plain light background works best. Hidden camera data (such as location) is removed automatically.</p>
            {fieldErrors.file && <p id="photo-file-error" className="mt-1.5 text-sm font-medium text-red-700">{fieldErrors.file}</p>}
          </div>
          <TextField id="alt" label="Description of the picture" required maxLength={200} hint="For people who can not see it and for search engines, e.g. “Blue ball pen, box of 10”." error={fieldErrors.imageAlt} defaultValue={imageAlt ?? ""} />
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Uploading…" : imageUrl ? "Replace picture" : "Upload picture"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
