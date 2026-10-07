import { describe, expect, it } from "vitest";
import { describeSiteUrlProblem } from "@/lib/site-url-check";

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
  ])("flags %s", (_label, url) => {
    expect(describeSiteUrlProblem(url)).toEqual(expect.any(String));
  });

  it("accepts a real public address", () => {
    expect(describeSiteUrlProblem("https://www.munnapencenter.in")).toBeNull();
    expect(describeSiteUrlProblem("https://munnapencenter.in/")).toBeNull();
  });

  it("explains what will go wrong", () => {
    expect(describeSiteUrlProblem("http://localhost:3000")).toMatch(/canonical|sitemap|Open Graph/i);
  });
});
