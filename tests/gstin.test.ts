import { describe, expect, it, vi } from "vitest";
import { normaliseGstin } from "@/lib/gstin";

const SAMPLE = "29ABCDE1234F1Z5"; // the standard dummy shape, not a real registration

describe("normaliseGstin", () => {
  it("accepts a well-formed GSTIN, tolerating the slips people make in an environment-variable form", () => {
    for (const typed of [SAMPLE, ` ${SAMPLE} `, SAMPLE.toLowerCase(), `"${SAMPLE}"`, `'${SAMPLE}'`, `${SAMPLE}\n`, ` "${SAMPLE.toLowerCase()}" `]) {
      expect(normaliseGstin(typed), JSON.stringify(typed)).toEqual({ gstin: SAMPLE });
    }
  });

  it("treats nothing as 'not set' without complaint", () => {
    for (const typed of [undefined, "", "   ", '""']) expect(normaliseGstin(typed), JSON.stringify(typed)).toEqual({ gstin: null, problem: null });
  });

  it("rejects the wrong thing with a helpful message that never contains the value", () => {
    const wrong: [string, RegExp][] = [
      ["GSTIN: " + SAMPLE, /has 22 characters/],
      ["29ABCDE1234F1Z", /has 14 characters/],
      ["29ABCDE1234F1X5", /not in the GSTIN pattern/],
      ["BUSINESS_GSTIN=" + SAMPLE, /characters/],
      ["12", /has 2 characters/],
    ];
    for (const [typed, message] of wrong) {
      const result = normaliseGstin(typed);
      expect(result.gstin, typed).toBeNull();
      expect(result.problem, typed).toMatch(message);
      expect(result.problem, typed).not.toContain(typed);
      expect(result.problem, typed).toMatch(/BUSINESS_GSTIN/);
    }
  });
});

describe("getBusinessGstin never breaks a page", () => {
  const load = async (value: string | undefined) => {
    vi.resetModules();
    if (value === undefined) vi.unstubAllEnvs();
    else vi.stubEnv("BUSINESS_GSTIN", value);
    return (await import("@/lib/business")).getBusinessGstin;
  };

  it("returns the GSTIN when valid and null (not an exception) when missing or mistyped, warning once without the value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await load(SAMPLE))()).toBe(SAMPLE);
    expect((await load(`"${SAMPLE}"`))()).toBe(SAMPLE);
    expect((await load(undefined))()).toBeNull();

    const getBad = await load("definitely wrong");
    expect(getBad()).toBeNull();
    expect(getBad()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("definitely wrong");
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
