import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getServerEnv, serverEnvSchema } from "@/lib/env";

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

  it("keeps secrets out of the client: only NEXT_PUBLIC_ vars are referenced in client-reachable code", async () => {
    const { readdir, readFile: read } = await import("node:fs/promises");
    const offenders: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = await read(full, "utf8");
          if (/^["']use client["']/m.test(source) && /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV)/.test(source)) offenders.push(full);
        }
      }
    }
    await walk("components");
    await walk("app");
    expect(offenders).toEqual([]);
  });
});
