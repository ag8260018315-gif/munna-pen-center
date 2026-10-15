"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { tableClasses } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

interface Problem {
  line: number;
  messages: string[];
}
interface PreviewRow {
  line: number;
  name: string;
  category: string;
  brand: string | null;
  status: string;
  hasPrices: boolean;
}
type Outcome =
  | { kind: "ready"; total: number; rows: PreviewRow[] }
  | { kind: "problems"; total: number; fileError?: string; problems: Problem[] }
  | { kind: "done"; created: number }
  | { kind: "error"; message: string };

const MAX_BYTES = 1024 * 1024;

/** Step 1: check the spreadsheet (nothing is saved). Step 2: import it, only if every row is fine. */
export function ImportTool() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function send(mode: "check" | "import") {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setOutcome({ kind: "error", message: "That file is larger than 1 MB. Split it into smaller files." });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", mode);
      const response = await fetch("/api/admin/product-import", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.status === 401 || response.status === 403) {
        setOutcome({ kind: "error", message: "Please sign in again, then try once more." });
      } else if (typeof data.error === "string") {
        setOutcome({ kind: "error", message: data.error });
      } else if (mode === "check" && data.ok === true) {
        setOutcome({ kind: "ready", total: Number(data.total), rows: data.rows as PreviewRow[] });
      } else if (mode === "import" && data.ok === true) {
        setOutcome({ kind: "done", created: Number(data.created) });
        router.refresh();
      } else if (data.ok === false) {
        setOutcome({ kind: "problems", total: Number(data.total ?? 0), fileError: (data.fileError as string | undefined) ?? (data.problems && !(data.problems as Problem[]).length ? (data.message as string) : undefined), problems: (data.problems as Problem[]) ?? [] });
      } else {
        setOutcome({ kind: "error", message: "Something went wrong. Please try again." });
      }
    } catch {
      setOutcome({ kind: "error", message: "The upload did not go through. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5" aria-busy={busy}>
      <div>
        <label htmlFor="csv-file" className="mb-1.5 block text-sm font-semibold">
          Your spreadsheet (CSV file) <span className="text-red-700" aria-hidden="true">*</span>
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setOutcome(null);
          }}
          className="block w-full max-w-md text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:font-semibold"
        />
      </div>
      <div>
        <Button type="button" onClick={() => send("check")} disabled={!file || busy}>
          {busy ? "Checking…" : "Check the file"}
        </Button>
      </div>

      <div aria-live="polite" className="grid gap-4">
        {outcome?.kind === "error" && <Notice kind="error">{outcome.message}</Notice>}

        {outcome?.kind === "problems" && (
          <>
            <Notice kind="error">
              {outcome.fileError ?? `${outcome.problems.length} of ${outcome.total} rows need fixing.`} Nothing was imported. Fix the spreadsheet, save it as CSV again and choose it above.
            </Notice>
            {outcome.problems.length > 0 && (
              <div className={tableClasses.wrap}>
                <table className={tableClasses.table}>
                  <caption className="sr-only">Rows that need fixing</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={tableClasses.th}>Row</th>
                      <th scope="col" className={tableClasses.th}>What to fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.problems.map((p) => (
                      <tr key={p.line}>
                        <th scope="row" className={`${tableClasses.td} font-semibold`}>Row {p.line}</th>
                        <td className={tableClasses.td}>
                          <ul className="grid gap-1">
                            {p.messages.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {outcome?.kind === "ready" && (
          <>
            <Notice kind="success">
              The file is fine: {outcome.total} product{outcome.total === 1 ? "" : "s"} ready to import. Nothing has been saved yet.
            </Notice>
            <div className={tableClasses.wrap}>
              <table className={tableClasses.table}>
                <caption className="sr-only">Products that will be added{outcome.total > outcome.rows.length ? ` (first ${outcome.rows.length} of ${outcome.total})` : ""}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={tableClasses.th}>Row</th>
                    <th scope="col" className={tableClasses.th}>Name</th>
                    <th scope="col" className={tableClasses.th}>Category</th>
                    <th scope="col" className={tableClasses.th}>Brand</th>
                    <th scope="col" className={tableClasses.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.rows.map((r) => (
                    <tr key={r.line}>
                      <td className={tableClasses.td}>{r.line}</td>
                      <th scope="row" className={`${tableClasses.td} font-semibold`}>{r.name}</th>
                      <td className={tableClasses.td}>{r.category}</td>
                      <td className={tableClasses.td}>{r.brand ?? "—"}</td>
                      <td className={tableClasses.td}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {outcome.total > outcome.rows.length && <p className="text-sm text-muted">Showing the first {outcome.rows.length} of {outcome.total}.</p>}
            <div>
              <Button type="button" onClick={() => send("import")} disabled={busy}>
                {busy ? "Importing…" : `Import ${outcome.total} product${outcome.total === 1 ? "" : "s"}`}
              </Button>
            </div>
          </>
        )}

        {outcome?.kind === "done" && (
          <Notice kind="success">
            Done: {outcome.created} product{outcome.created === 1 ? "" : "s"} added. <Link href="/admin/products" className="font-semibold underline">See the products</Link> · <Link href="/admin/products/pictures" className="font-semibold underline">Add pictures</Link>
          </Notice>
        )}
      </div>
    </div>
  );
}
