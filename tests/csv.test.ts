import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("reads plain rows with LF and CRLF line ends and a final line without a newline", () => {
    expect(parseCsv("a,b,c\n1,2,3\r\n4,5,6").rows).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
  });
  it("keeps commas, line breaks and doubled quotes inside quoted cells", () => {
    expect(parseCsv('name,note\n"Pen, blue","say ""hi""\nsecond line"\n').rows).toEqual([["name", "note"], ["Pen, blue", 'say "hi"\nsecond line']]);
  });
  it("drops a leading byte-order mark and ignores empty rows (Excel's trailing commas)", () => {
    expect(parseCsv("﻿name,sku\nPen,A1\n,\n\n,,\n").rows).toEqual([["name", "sku"], ["Pen", "A1"]]);
  });
  it("keeps empty cells and cells with spaces as they are", () => {
    expect(parseCsv("a,,c\n , x ,").rows).toEqual([["a", "", "c"], [" ", " x ", ""]]);
  });
  it("reports an unterminated quote instead of swallowing the rest of the file", () => {
    expect(parseCsv('a,b\n"oops,1\n2,3').error).toMatch(/never closed/);
  });
  it("handles non-ASCII text and an empty file", () => {
    expect(parseCsv("name\nपेन\n").rows).toEqual([["name"], ["पेन"]]);
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("\n\n").rows).toEqual([]);
  });
  it("treats a quote in the middle of a cell as ordinary text", () => {
    expect(parseCsv('a,5" ruler,c').rows).toEqual([["a", '5" ruler', "c"]]);
  });
});
