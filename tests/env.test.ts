import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getServerEnv, serverEnvSchema } from "@/lib/env";

/**
 * Only NEXT_PUBLIC_* and NODE_ENV may be read with dot access. Bracket access, destructuring and passing
 * `process.env` around are all rejected, because they can reach secrets and slip past a simple pattern.
 * One constant, used by the scan AND by the detector self-test, so the self-test cannot drift from the real check.
 */
const forbidden = /process\s*\.\s*env(?!\s*\.\s*(?:NEXT_PUBLIC_[A-Z0-9_]+|NODE_ENV)\b)/;

describe("environment configuration", () => {
  it(".env.example documents exactly the variables the schema reads", async () => {
    const example = await readFile(".env.example", "utf8");
    const documented = example
      .split("\n")
      .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key) && key !== "NEXT_PUBLIC_SITE_URL")
      .sort();
    expect(documented).toEqual(Object.keys(serverEnvSchema.shape).sort());
  });

  it("treats empty values as unset and needs no secrets in V1", () => {
    expect(getServerEnv({ DATABASE_URL: "", AI_API_KEY: "" })).toEqual({});
  });

  it("reports which variable is wrong without echoing its value", () => {
    expect(() => getServerEnv({ DATABASE_URL: "not a url, s3cr3t" })).toThrow(/DATABASE_URL/);
    try {
      getServerEnv({ DATABASE_URL: "not a url, s3cr3t" });
    } catch (error) {
      expect(String(error)).not.toContain("s3cr3t");
    }
  });

  it("keeps secrets out of the client: no \"use client\" file under app/, components/ or lib/ reads a non-public variable (any syntax)", async () => {
    const { readdir, readFile: read } = await import("node:fs/promises");
    const offenders: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = await read(full, "utf8");
          if (/^["']use client["']/m.test(source) && forbidden.test(source)) offenders.push(full);
        }
      }
    }
    for (const dir of ["app", "components", "lib"]) await walk(dir);
    expect(offenders).toEqual([]);
  });

  it("the detector itself catches the sneaky forms", () => {
    for (const sneaky of ["process.env.AUTH_SECRET", 'process.env["AI_API_KEY"]', "const { AUTH_SECRET } = process.env;", "send(process.env)", "process . env.DATABASE_URL"]) {
      expect(forbidden.test(sneaky), sneaky).toBe(true);
    }
    for (const fine of ["process.env.NEXT_PUBLIC_SITE_URL", "process.env.NODE_ENV", "process.env.NEXT_PUBLIC_SITE_URL ?? 'x'"]) {
      expect(forbidden.test(fine), fine).toBe(false);
    }
  });

  it("BUSINESS_GSTIN: accepts a correctly shaped GSTIN (any case), treats empty as unset, rejects anything else without echoing it", () => {
    const sample = "29ABCDE1234F1Z5"; // the standard dummy shape, not a real registration
    expect(getServerEnv({ BUSINESS_GSTIN: sample }).BUSINESS_GSTIN).toBe(sample);
    expect(getServerEnv({ BUSINESS_GSTIN: ` ${sample.toLowerCase()} ` }).BUSINESS_GSTIN).toBe(sample);
    expect(getServerEnv({ BUSINESS_GSTIN: "" }).BUSINESS_GSTIN).toBeUndefined();
    expect(getServerEnv({}).BUSINESS_GSTIN).toBeUndefined();
    for (const bad of ["123", "29ABCDE1234F1Z", "29ABCDE1234F1X5", "not-a-gstin-xx"]) {
      expect(() => getServerEnv({ BUSINESS_GSTIN: bad }), bad).toThrow(/BUSINESS_GSTIN/);
    }
  });

  it("no GSTIN is written into source, docs or config — it lives only in the BUSINESS_GSTIN environment variable", async () => {
    const { readdir, readFile: read } = await import("node:fs/promises");
    const gstin = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;
    const offenders: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git" || entry.name === "generated") continue;
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(full);
        else if (/\.(tsx?|mjs|json|md|prisma|ya?ml|example|css|svg)$/.test(entry.name) || entry.name.startsWith(".env")) {
          if (gstin.test(await read(full, "utf8"))) offenders.push(full);
        }
      }
    }
    for (const dir of ["app", "components", "content", "data", "lib", "docs", "prisma", "scripts", ".github"]) await walk(dir);
    for (const file of ["README.md", "CLAUDE.md", ".env.example", "package.json"]) if (gstin.test(await read(file, "utf8"))) offenders.push(file);
    expect(offenders).toEqual([]);
  });
});
