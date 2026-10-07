import { appendFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewEnquiry } from "@/lib/domain/types";
import { generateEnquiryIdentity } from "@/lib/domain/identifiers";
import { FileEnquiryRepository } from "@/lib/repositories/file-enquiries";

const sample = (name: string): NewEnquiry => ({
  source: "BULK_ORDER_FORM",
  name,
  phone: "+919876543210",
  city: "Ranchi",
  state: "Jharkhand",
  productsRequired: "Registers",
  items: [],
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "mpc-file-repo-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("FileEnquiryRepository", () => {
  it("assigns id, reference, status and timestamp", async () => {
    const repo = new FileEnquiryRepository(dir);
    const saved = await repo.create(sample("Asha"));
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.reference).toMatch(/^ENQ-\d{8}-[A-Z2-9]{4}$/);
    expect(saved.status).toBe("NEW");
    expect(Date.parse(saved.createdAt)).not.toBeNaN();
  });

  it("lists newest first and honours the limit", async () => {
    const repo = new FileEnquiryRepository(dir);
    for (const name of ["first", "second", "third"]) await repo.create(sample(name));
    expect((await repo.list()).map((e) => e.name)).toEqual(["third", "second", "first"]);
    expect((await repo.list({ limit: 2 })).map((e) => e.name)).toEqual(["third", "second"]);
  });

  it("returns an empty list before anything has been saved", async () => {
    expect(await new FileEnquiryRepository(path.join(dir, "missing")).list()).toEqual([]);
  });

  it("skips a corrupt line instead of losing every other enquiry", async () => {
    const repo = new FileEnquiryRepository(dir);
    await repo.create(sample("good-1"));
    await appendFile(path.join(dir, "enquiries.jsonl"), "{this is not json\n");
    await repo.create(sample("good-2"));
    expect((await repo.list()).map((e) => e.name)).toEqual(["good-2", "good-1"]);
  });
});

describe("generateEnquiryIdentity", () => {
  it("makes unique, readable references without ambiguous characters", () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateEnquiryIdentity().reference));
    expect(refs.size).toBeGreaterThan(490);
    for (const ref of refs) expect(ref).not.toMatch(/[01OIL]$/);
  });
});
