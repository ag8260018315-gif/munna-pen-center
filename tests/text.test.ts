import { describe, expect, it } from "vitest";
import { sanitiseText, truncate, wellFormed } from "@/lib/text";

const LONE_HIGH = String.fromCharCode(0xd83d);
const LONE_LOW = String.fromCharCode(0xde4f);
const FFFD = String.fromCharCode(0xfffd);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe("wellFormed", () => {
  it("leaves ordinary text and complete emoji untouched", () => {
    expect(wellFormed("Ball pens 🙏 ✓")).toBe("Ball pens 🙏 ✓");
  });

  it("replaces a lone high or low surrogate so the string can be URL-encoded", () => {
    expect(wellFormed(`a${LONE_HIGH}b`)).toBe(`a${FFFD}b`);
    expect(wellFormed(`a${LONE_LOW}b`)).toBe(`a${FFFD}b`);
    expect(() => encodeURIComponent(wellFormed(`a${LONE_HIGH}`))).not.toThrow();
    expect(() => encodeURIComponent(`a${LONE_HIGH}`)).toThrow(URIError);
  });
});

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("abc", 3)).toBe("abc");
    expect(truncate("", 5)).toBe("");
  });

  it("cuts to exactly `max` characters including the ellipsis", () => {
    const out = truncate("abcdefghij", 5);
    expect(out).toBe("abcd…");
    expect(Array.from(out)).toHaveLength(5);
  });

  it("supports a plain hard cut with an empty ellipsis", () => {
    expect(truncate("abcdefghij", 4, "")).toBe("abcd");
  });

  it("never splits an emoji at the cut-off", () => {
    const text = "ab🙏🙏🙏";
    for (let max = 0; max <= 6; max++) {
      const out = truncate(text, max, "");
      expect(() => encodeURIComponent(out)).not.toThrow();
      expect(Array.from(out).length).toBeLessThanOrEqual(max);
    }
    expect(truncate(text, 3, "")).toBe("ab🙏");
  });

  it("copes with a maximum smaller than the ellipsis", () => {
    expect(() => truncate("abcdef", 0)).not.toThrow();
    expect(truncate("abcdef", 0, "")).toBe("");
  });

  it("repairs lone surrogates in its input", () => {
    expect(truncate(`x${LONE_HIGH}`, 10)).toBe(`x${FFFD}`);
  });
});

describe("sanitiseText", () => {
  it("turns CRLF and CR into a single newline", () => {
    expect(sanitiseText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("keeps tabs and newlines but drops other control characters", () => {
    const esc = String.fromCharCode(0x1b);
    const nul = String.fromCharCode(0);
    const del = String.fromCharCode(0x7f);
    expect(sanitiseText(`a\tb\nc${esc}[31md${nul}e${del}`)).toBe("a\tb\nc[31mde");
  });

  it("turns Unicode line and paragraph separators into newlines", () => {
    expect(sanitiseText(`a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c`)).toBe("a\nb\nc");
  });

  it("preserves ordinary Unicode text", () => {
    expect(sanitiseText("मुन्ना पेन सेंटर – ₹ 🙏")).toBe("मुन्ना पेन सेंटर – ₹ 🙏");
  });
});
