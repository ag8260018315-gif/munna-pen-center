"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Notice, tableClasses } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export interface PictureProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  hasPicture: boolean;
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Same rule as the server's slugs: lower-case words joined by hyphens ("Blue Pen.JPG" → "blue-pen"). */
const stemToSlug = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type Plan =
  | { kind: "upload"; file: File; product: PictureProduct; replaces: boolean }
  | { kind: "skip"; file: File; product: PictureProduct; reason: string }
  | { kind: "problem"; file: File; reason: string };

type RowState = "waiting" | "uploading" | "done" | { error: string };

/**
 * Many pictures in one go. Each file is matched to a product by its NAME: blue-pen.jpg goes to the product whose web
 * address (slug) is blue-pen, or whose SKU is BLUE-PEN. Pictures are then sent one at a time through the same route as
 * the single upload, so every file gets the same server-side checks and re-encoding.
 */
export function PicturesTool({ products }: { products: PictureProduct[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [replace, setReplace] = useState(false);
  const [representative, setRepresentative] = useState(false);
  const [running, setRunning] = useState(false);
  const [rowState, setRowState] = useState<Record<number, RowState>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const index = useMemo(() => {
    const map = new Map<string, PictureProduct>();
    for (const p of products) {
      map.set(p.slug, p);
      if (p.sku) map.set(stemToSlug(p.sku), p);
    }
    return map;
  }, [products]);

  const plans: Plan[] = useMemo(() => {
    const used = new Set<string>();
    return files.map((file): Plan => {
      if (!TYPES.includes(file.type)) return { kind: "problem", file, reason: "Not a JPG, PNG or WebP picture." };
      if (file.size > MAX_BYTES) return { kind: "problem", file, reason: "Larger than 8 MB." };
      const product = index.get(stemToSlug(file.name));
      if (!product) return { kind: "problem", file, reason: "No product has this web address or SKU. Rename the file after the product, e.g. blue-pen.jpg." };
      if (used.has(product.id)) return { kind: "skip", file, product, reason: "Another file in this list is already for this product." };
      used.add(product.id);
      if (product.hasPicture && !replace) return { kind: "skip", file, product, reason: "Already has a picture. Tick “Replace existing pictures” to change it." };
      return { kind: "upload", file, product, replaces: product.hasPicture };
    });
  }, [files, index, replace]);

  const toUpload = plans.filter((p): p is Extract<Plan, { kind: "upload" }> => p.kind === "upload");

  async function run() {
    setRunning(true);
    setSummary(null);
    const state: Record<number, RowState> = {};
    plans.forEach((p, i) => {
      if (p.kind === "upload") state[i] = "waiting";
    });
    setRowState({ ...state });
    let ok = 0;
    let failed = 0;
    for (const [i, plan] of plans.entries()) {
      if (plan.kind !== "upload") continue;
      state[i] = "uploading";
      setRowState({ ...state });
      try {
        const body = new FormData();
        body.set("productId", plan.product.id);
        body.set("alt", `${representative ? "Representative image: " : ""}${plan.product.name}`.slice(0, 200));
        body.set("file", plan.file);
        const response = await fetch("/api/admin/product-image", { method: "POST", body });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          state[i] = { error: data.error ?? "Could not upload." };
          failed++;
          if (response.status === 401 || response.status === 403 || response.status === 503) {
            setRowState({ ...state });
            setSummary(`Stopped: ${data.error ?? "the server refused the upload"}. ${ok} uploaded before that.`);
            setRunning(false);
            router.refresh();
            return;
          }
        } else {
          state[i] = "done";
          ok++;
        }
      } catch {
        state[i] = { error: "The upload did not go through." };
        failed++;
      }
      setRowState({ ...state });
    }
    setSummary(`${ok} picture${ok === 1 ? "" : "s"} uploaded${failed ? `, ${failed} failed (see the list)` : ""}.`);
    setRunning(false);
    router.refresh();
  }

  const label = (i: number, p: Plan) => {
    const s = rowState[i];
    if (p.kind === "problem") return <span className="font-semibold text-red-700">{p.reason}</span>;
    if (p.kind === "skip") return <span className="text-muted">Skipped — {p.reason}</span>;
    if (s === "done") return <span className="font-semibold text-emerald-800">Uploaded</span>;
    if (s === "uploading") return <span>Uploading…</span>;
    if (s && typeof s === "object") return <span className="font-semibold text-red-700">{s.error}</span>;
    return <span>{p.replaces ? "Will replace the current picture" : "Will upload"}</span>;
  };

  return (
    <div className="grid gap-5" aria-busy={running}>
      <div>
        <label htmlFor="pictures" className="mb-1.5 block text-sm font-semibold">
          Choose the pictures (you can select many) <span className="text-red-700" aria-hidden="true">*</span>
        </label>
        <input
          id="pictures"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={running}
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []).slice(0, 100));
            setRowState({});
            setSummary(null);
          }}
          className="block w-full max-w-md text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:font-semibold"
        />
        <p className="mt-1.5 text-sm text-muted">Up to 100 at a time, 8 MB each.</p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="sr-only">Options</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={replace} disabled={running} onChange={(e) => setReplace(e.target.checked)} className="mt-1 size-5 rounded border-slate-400" />
          <span>
            <span className="font-semibold">Replace existing pictures</span>
            <span className="block text-muted">Off: products that already have a picture are skipped.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={representative} disabled={running} onChange={(e) => setRepresentative(e.target.checked)} className="mt-1 size-5 rounded border-slate-400" />
          <span>
            <span className="font-semibold">These are generic or AI-made pictures, not photos of my stock</span>
            <span className="block text-muted">Starts each picture&apos;s description with “Representative image:” so it is honest for blind visitors and search engines.</span>
          </span>
        </label>
      </fieldset>

      {plans.length > 0 && (
        <div className={tableClasses.wrap}>
          <table className={tableClasses.table}>
            <caption className="sr-only">Pictures and the products they match</caption>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.th}>File</th>
                <th scope="col" className={tableClasses.th}>Product</th>
                <th scope="col" className={tableClasses.th}>What happens</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={`${p.file.name}-${i}`}>
                  <th scope="row" className={`${tableClasses.td} font-semibold`}>{p.file.name}</th>
                  <td className={tableClasses.td}>{"product" in p ? p.product.name : "—"}</td>
                  <td className={tableClasses.td}>{label(i, p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div aria-live="polite" className="grid gap-3">
        {summary && <Notice kind={summary.startsWith("Stopped") || summary.includes("failed") ? "error" : "success"}>{summary}</Notice>}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={run} disabled={running || toUpload.length === 0}>
          {running ? "Uploading…" : toUpload.length ? `Upload ${toUpload.length} picture${toUpload.length === 1 ? "" : "s"}` : "Upload"}
        </Button>
        <Link href="/admin/products" className="text-sm font-semibold text-brand-800 underline">Back to products</Link>
      </div>
    </div>
  );
}
