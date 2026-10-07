import { describe, expect, it } from "vitest";
import { describeSiteUrlProblem, normaliseSiteUrl } from "@/lib/site-url-check";

describe("production-build guard for NEXT_PUBLIC_SITE_URL", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["the .env.example default", "http://localhost:3000"],
    ["localhost on another port", "http://localhost:3100/"],
    ["loopback IP", "http://127.0.0.1:3000"],
    ["IPv6 loopback", "http://[::1]:3000"],
    ["not a URL", "yourdomain.in"],
    // These parse as custom URL schemes with an empty hostname, so a naive hostname check lets them through.
    ["localhost without a scheme", "localhost:3000"],
    ["a domain and port without a scheme", "yourdomain.in:8080"],
    ["a non-web scheme", "ftp://files.example.in"],
    ["a script URL", "javascript:alert(1)"],
  ])("flags %s", (_label, url) => {
    expect(describeSiteUrlProblem(url)).toEqual(expect.any(String));
  });

  it("accepts a real public address", () => {
    expect(describeSiteUrlProblem("https://www.munnapencenter.in")).toBeNull();
    expect(describeSiteUrlProblem("https://munnapencenter.in/")).toBeNull();
  });

  it("normaliseSiteUrl returns an absolute http(s) address without a trailing slash, or null — so the layout can never be handed a value that crashes new URL()", () => {
    expect(normaliseSiteUrl("https://www.munnapencenter.in/")).toBe("https://www.munnapencenter.in");
    expect(normaliseSiteUrl("  http://localhost:3000  ")).toBe("http://localhost:3000");
    for (const bad of [undefined, "", "   ", "yourdomain.in", "localhost:3000", "yourdomain.in:8080", "ftp://x.in", "javascript:alert(1)", "http://"]) {
      expect(normaliseSiteUrl(bad), String(bad)).toBeNull();
      expect(() => new URL(normaliseSiteUrl(bad) ?? "http://localhost:3000")).not.toThrow();
    }
  });

  it("explains what will go wrong", () => {
    expect(describeSiteUrlProblem("http://localhost:3000")).toMatch(/canonical|sitemap|Open Graph/i);
  });
});
