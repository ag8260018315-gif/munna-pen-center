import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Node version is stated once and consistently", () => {
  it("engines, .nvmrc, README and CI agree, and match what the dev toolchain needs", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as { engines: { node: string } };
    const floor = /(\d+)\.(\d+)\.\d+/.exec(pkg.engines.node);
    expect(floor, "engines.node must be a plain >=X.Y.Z").not.toBeNull();
    const [major, minor] = [Number(floor![1]), Number(floor![2])];
    // vitest 5, vite 8 and prisma 7 need Node >= 22.12 (or 20.19); engines used to say 20.9 and `npm test` crashed there.
    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true);

    const nvmrc = (await readFile(".nvmrc", "utf8")).trim();
    expect(Number(nvmrc.split(".")[0])).toBeGreaterThanOrEqual(major);

    const readme = await readFile("README.md", "utf8");
    const claimed = [...readme.matchAll(/Node\.js (\d+)\.(\d+)\+/g)].map((m) => `${m[1]}.${m[2]}`);
    expect(claimed.length).toBeGreaterThan(0);
    for (const version of claimed) expect(version).toBe(`${major}.${minor}`);

    const ci = await readFile(".github/workflows/ci.yml", "utf8");
    expect(/node-version:\s*(\d+)/.exec(ci)?.[1]).toBe(String(major));
  });
});
