import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewEnquiry } from "@/lib/domain/types";
import { FileEnquiryRepository } from "@/lib/repositories/file-enquiries";
import { initialFormState } from "@/lib/validation/form-state";
import { buildEnquiryWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Regression tests for bugs found in the PR #1 review. Each one FAILED on the code as first
 * submitted; they pin the fixes down.
 */

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("text with emoji at a truncation boundary", () => {
  // 298 letters, then a 2-unit emoji: a naive slice(0, 299) cuts it in half.
  const nasty = `${"a".repeat(298)}🙏${"tail ".repeat(20)}`;

  it("never produces a broken (lone-surrogate) WhatsApp message", () => {
    const message = buildEnquiryWhatsAppMessage({ name: "Asha", phone: "+919876543210", productsRequired: nasty });
    expect(message).not.toMatch(LONE_SURROGATE);
  });

  it("builds a WhatsApp URL without throwing, even from malformed text", () => {
    const message = buildEnquiryWhatsAppMessage({ name: "Asha", phone: "+919876543210", productsRequired: nasty });
    expect(() => buildWhatsAppUrl(message)).not.toThrow();
    // encodeURIComponent throws on a lone surrogate; the builder must repair it instead.
    expect(() => buildWhatsAppUrl("broken \uD83D end")).not.toThrow();
    expect(() => buildWhatsAppUrl("\uDE4F")).not.toThrow();
  });

  it("keeps whole emoji when the text fits", () => {
    const url = new URL(buildWhatsAppUrl("Thank you 🙏"));
    expect(url.searchParams.get("text")).toBe("Thank you 🙏");
  });
});

describe("enquiry actions", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mpc-robust-"));
    vi.stubEnv("ENQUIRY_DATA_DIR", dir);
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  const contactForm = (message: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ kind: "contact", name: "Ravi", phone: "9876543210", email: "", message, website: "" })) fd.append(k, v);
    return fd;
  };

  const quoteForm = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    const fields: Record<string, string> = {
      kind: "quote",
      name: "Asha Kumari",
      phone: "9876543210",
      city: "Ranchi",
      state: "Jharkhand",
      productsRequired: "Registers",
      website: "",
      ...extra,
    };
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
  };

  it("reports success — not an error — when a saved enquiry has an emoji at the WhatsApp cut-off", async () => {
    const { submitContactAction } = await import("@/app/actions/enquiry");
    const state = await submitContactAction(initialFormState, contactForm(`${"a".repeat(298)}🙏 please call me about registers`));
    expect(state.status).toBe("success");
    if (state.status === "success") expect(() => new URL(state.whatsappUrl)).not.toThrow();
    expect((await readFile(path.join(dir, "enquiries.jsonl"), "utf8")).trim().split("\n")).toHaveLength(1);
  });

  it("counts a browser's CRLF line breaks as one character and stores plain \\n", async () => {
    const { submitContactAction } = await import("@/app/actions/enquiry");
    // 900 lines: 1,800 characters as the textarea counts them (within the 2,000 limit), but 2,700 as a browser
    // submits them (each break as \r\n) — which the server used to reject.
    const message = "x\r\n".repeat(900);
    const state = await submitContactAction(initialFormState, contactForm(message));
    expect(state.status).toBe("success");
    const saved = JSON.parse((await readFile(path.join(dir, "enquiries.jsonl"), "utf8")).trim());
    expect(saved.additionalRequirements).not.toContain("\r");
    expect(saved.additionalRequirements.split("\n").length).toBeGreaterThan(800);
  });

  it("normalises line breaks in the values it hands back after a validation error", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, quoteForm({ phone: "123", additionalRequirements: "line1\r\nline2" }));
    expect(state.status).toBe("error");
    if (state.status === "error") expect(state.values?.additionalRequirements).toBe("line1\nline2");
  });
});

describe("FileEnquiryRepository after an interrupted write", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mpc-torn-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const sample = (name: string): NewEnquiry => ({
    source: "CONTACT_FORM",
    name,
    phone: "+919876543210",
    productsRequired: "General enquiry",
    items: [],
  });

  it("still reads the next enquiry when the previous append was cut short", async () => {
    const repo = new FileEnquiryRepository(dir);
    await repo.create(sample("before"));
    await appendFile(path.join(dir, "enquiries.jsonl"), '{"id":"torn","name":"par'); // no trailing newline: disk full / power loss
    await repo.create(sample("after"));
    const names = (await repo.list()).map((e) => e.name);
    expect(names).toContain("after");
    expect(names).toContain("before");
  });
});

describe("npm run enquiries (owner's viewer)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mpc-viewer-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("neutralises terminal escape sequences and fake rows planted by a visitor", async () => {
    const hostile = {
      id: "1",
      reference: "ENQ-20261006-REAL",
      source: "CONTACT_FORM",
      status: "NEW",
      name: "Ravi\u001b]0;PWNED\u0007\u001b[31mRED",
      phone: "+919876543210",
      productsRequired: "Registers\r\nENQ-20261006-FAKE · 6 Oct 2026 · BULK_ORDER_FORM\r\n\u001b[1A\u001b[2K",
      additionalRequirements: `line1\u0000\u0008\u007fline2${String.fromCharCode(0x2028)}line3`,
      items: [],
      createdAt: "2026-10-06T10:00:00.000Z",
    };
    await writeFile(path.join(dir, "enquiries.jsonl"), `${JSON.stringify(hostile)}\n`);
    const out = execFileSync(process.execPath, ["scripts/list-enquiries.mjs"], { env: { ...process.env, ENQUIRY_DATA_DIR: dir }, encoding: "utf8" });
    // C0/C1 control characters plus the Unicode line / paragraph separators (built from code points on purpose).
    const unsafe = new RegExp(`[\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`);
    expect(out).not.toMatch(unsafe);
    // The planted "second enquiry" must not appear on a line of its own.
    expect(out.split("\n").filter((line) => line.startsWith("ENQ-"))).toEqual([expect.stringContaining("ENQ-20261006-REAL")]);
  });

  it("drops bidirectional override characters so a name cannot reverse the phone number next to it", async () => {
    const rlo = String.fromCharCode(0x202e);
    const isolate = String.fromCharCode(0x2067);
    const record = { id: "1", reference: "ENQ-20261006-BIDI", source: "CONTACT_FORM", status: "NEW", name: `Ravi ${rlo}${isolate}`, phone: "+919876543210", items: [], createdAt: "2026-10-06T10:00:00.000Z" };
    await writeFile(path.join(dir, "enquiries.jsonl"), `${JSON.stringify(record)}\n`);
    const out = execFileSync(process.execPath, ["scripts/list-enquiries.mjs"], { env: { ...process.env, ENQUIRY_DATA_DIR: dir }, encoding: "utf8" });
    expect(out).toContain("Ravi");
    expect(out).not.toContain(rlo);
    expect(out).not.toContain(isolate);
  });
});

describe("npm run enquiries finds the store the way the server does", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "mpc-viewer-env-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const record = (n: number) => ({
    id: String(n),
    reference: `ENQ-20261007-REC${n}`,
    source: "CONTACT_FORM",
    status: "NEW",
    name: `Customer ${n}`,
    phone: "+919876543210",
    productsRequired: `Registers batch ${n} ${"x".repeat(120)}`,
    items: [],
    createdAt: `2026-10-07T10:0${n}:00.000Z`,
  });

  const viewer = (cwd: string, args: string[] = [], env: Record<string, string> = {}) =>
    execFileSync(process.execPath, [path.resolve("scripts/list-enquiries.mjs"), ...args], {
      cwd,
      env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });

  it("reads ENQUIRY_DATA_DIR from .env.local, because that is where the README tells the owner to put it", async () => {
    const dataDir = path.join(root, "volume");
    await mkdtemp(path.join(root, "x-")); // ensure root exists
    await import("node:fs/promises").then((fs) => fs.mkdir(dataDir, { recursive: true }));
    await writeFile(path.join(dataDir, "enquiries.jsonl"), `${JSON.stringify(record(1))}\n`);
    await writeFile(path.join(root, ".env.local"), `ENQUIRY_DATA_DIR=${dataDir}\n`);
    const out = viewer(root);
    expect(out).toContain("ENQ-20261007-REC1");
    expect(out).not.toContain("No enquiries yet");
  });

  it("lets a variable already set in the shell win over the .env files", async () => {
    const fs = await import("node:fs/promises");
    const fromEnvFile = path.join(root, "from-file");
    const fromShell = path.join(root, "from-shell");
    await fs.mkdir(fromEnvFile, { recursive: true });
    await fs.mkdir(fromShell, { recursive: true });
    await writeFile(path.join(fromEnvFile, "enquiries.jsonl"), `${JSON.stringify(record(1))}\n`);
    await writeFile(path.join(fromShell, "enquiries.jsonl"), `${JSON.stringify(record(2))}\n`);
    await writeFile(path.join(root, ".env.local"), `ENQUIRY_DATA_DIR=${fromEnvFile}\n`);
    const out = viewer(root, [], { ENQUIRY_DATA_DIR: fromShell });
    expect(out).toContain("REC2");
    expect(out).not.toContain("REC1");
  });

  it("says where it looked, and how to point it elsewhere, when there is nothing to show", () => {
    const out = viewer(root);
    expect(out).toMatch(/No enquiries yet/);
    expect(out).toMatch(/ENQUIRY_DATA_DIR/);
  });

  it("reads only the newest part of a huge store instead of crashing, and says so", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(root, ".data"), { recursive: true });
    const lines = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => JSON.stringify(record(n))).join("\n");
    await writeFile(path.join(root, ".data", "enquiries.jsonl"), `${lines}\n`);
    const out = viewer(root, ["--max-bytes=900"]);
    expect(out).toContain("REC8"); // newest is always there
    expect(out).not.toContain("REC1"); // oldest is outside the window
    expect(out).toMatch(/newest/i);
  });

  it("FileEnquiryRepository.list() does the same: bounded read, newest first, no throw on the cut line", async () => {
    const repo = new FileEnquiryRepository(path.join(root, "repo"), { maxReadBytes: 900 });
    for (let n = 1; n <= 8; n++) await repo.create({ source: "CONTACT_FORM", name: `Customer ${n}`, phone: "+919876543210", productsRequired: `Batch ${n} ${"x".repeat(120)}`, items: [] });
    const names = (await repo.list()).map((e) => e.name);
    expect(names[0]).toBe("Customer 8");
    expect(names).not.toContain("Customer 1");
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThan(8);
  });
});
