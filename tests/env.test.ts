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
});
