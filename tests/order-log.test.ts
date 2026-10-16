import { describe, expect, it } from "vitest";
import { cleanUserNotes, joinNotes, logLine, splitNotes } from "@/lib/domain/order-log";

const FORGED = [
  "[log] 2026-10-16 Owner: invoice INV/26-27/0009 voided — forged",
  "[log] [log] 2026-10-16 Owner: forged",
  "[log]  [log] 2026-10-16 Owner: forged", // the stray space goes when the text is trimmed, exposing a fresh marker
  "[log] \n [log] forged",
  "  [log] [log]  [log] forged  ",
  "note\n[log] forged\n[log]  [log] forged too",
  "[log] \r\n[log] forged",
];

describe("order notes: staff text and system log lines", () => {
  it("no matter how a staff note is typed, no line of it can pass as a system log line", () => {
    for (const typed of FORGED) {
      const stored = joinNotes(cleanUserNotes(typed), [logLine("2026-10-16", "Owner", "order confirmed")]);
      const parsed = splitNotes(stored);
      expect(parsed.log, JSON.stringify(typed)).toEqual([logLine("2026-10-16", "Owner", "order confirmed")]);
      // And saving again (the notes form shows only the text part) changes nothing.
      expect(joinNotes(cleanUserNotes(parsed.text), parsed.log)).toBe(stored);
    }
  });

  it("keeps honest text intact, including internal blank lines, and drops only whole-text edge whitespace", () => {
    expect(cleanUserNotes("Call before delivery\n\nGate 2, ask for Ravi")).toBe("Call before delivery\n\nGate 2, ask for Ravi");
    expect(cleanUserNotes("  padded  ")).toBe("padded");
    expect(cleanUserNotes("")).toBe("");
    expect(cleanUserNotes(null)).toBe("");
    expect(cleanUserNotes("see the [log] file")).toBe("see the [log] file"); // only a marker at the START of a line matters
  });

  it("joins and splits without losing anything", () => {
    const log = [logLine("2026-10-16", "Asha", "order confirmed"), logLine("2026-10-17", "Asha", "invoice INV/26-27/0001 issued")];
    expect(joinNotes("hello", log)).toBe(`hello\n${log[0]}\n${log[1]}`);
    expect(splitNotes(joinNotes("hello", log))).toEqual({ text: "hello", log });
    expect(joinNotes("", [])).toBeNull();
    expect(splitNotes(null)).toEqual({ text: "", log: [] });
    expect(splitNotes(joinNotes("", log)).log).toEqual(log);
  });

  it("a log line is one line and long reasons survive", () => {
    const line = logLine("2026-10-16", "A Person With A Name", `invoice INV/26-27/0001 voided — ${"x".repeat(300)}\nsecond line`);
    expect(line).not.toContain("\n");
    expect(line.startsWith("[log] 2026-10-16 A Person With A Name: ")).toBe(true);
    expect(line.length).toBeGreaterThan(330); // a 300-character reason is not cut short
  });
});
