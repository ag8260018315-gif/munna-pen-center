import { describe, expect, it } from "vitest";
import { amountInWords, computeInvoiceTaxes, GST_STATES, integerInWords, invoiceNumber, MAX_INVOICE_SEQUENCE, stateByCode, stateByName, stateCodeFromGstin, taxModeFor, UTGST_CODES } from "@/lib/domain/gst";

describe("GST states", () => {
  it("has each code once, two digits, and 36 entries (25 retired when Daman and Diu merged into 26)", () => {
    const codes = GST_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^\d{2}$/.test(c))).toBe(true);
    expect(codes).not.toContain("25");
    expect(GST_STATES).toHaveLength(36);
    expect(stateByCode("20")?.name).toBe("Jharkhand");
    expect(stateByCode("09")?.name).toBe("Uttar Pradesh");
    expect(stateByCode("99")).toBeNull();
    for (const code of UTGST_CODES) expect(stateByCode(code)).not.toBeNull();
  });

  it("reads the state from a GSTIN's first two digits, only when it is a known code", () => {
    expect(stateCodeFromGstin("20ABCDE1234F1Z5")).toBe("20");
    expect(stateCodeFromGstin("99ABCDE1234F1Z5")).toBeNull();
    expect(stateCodeFromGstin("")).toBeNull();
    expect(stateCodeFromGstin(null)).toBeNull();
  });

  it("recognises state names however they are typed, and nothing else", () => {
    for (const [typed, code] of [["Jharkhand", "20"], ["  jharkhand ", "20"], ["JHARKHAND", "20"], ["Orissa", "21"], ["Odisha", "21"], ["West Bengal", "19"], ["Jammu & Kashmir", "01"], ["J&K", "01"], ["NCT of Delhi", "07"], ["New Delhi", "07"], ["Delhi", "07"], ["Pondicherry", "34"], ["Andaman & Nicobar Islands", "35"], ["Chattisgarh", "22"], ["Daman and Diu", "26"], ["Dadra and Nagar Haveli and Daman and Diu", "26"], ["Tamil Nadu", "33"]] as const) {
      expect(stateByName(typed)?.code, typed).toBe(code);
    }
    for (const bad of ["", "   ", "Narnia", "Dhanbad", null, undefined, "20"]) expect(stateByName(bad as never), String(bad)).toBeNull();
  });
});

describe("tax split", () => {
  it("is intra-state only when the supplier's state is the place of supply", () => {
    expect(taxModeFor("20", "20")).toBe("INTRA_STATE");
    expect(taxModeFor("20", "09")).toBe("INTER_STATE");
  });

  it("intra-state: half the rate as CGST and half as SGST, per line, rounded half-up to the paisa", () => {
    const r = computeInvoiceTaxes([{ quantity: 3, unitPrice: "33.33", gstRatePercent: "18" }], "INTRA_STATE")!;
    // taxable 99.99; 9% = 8.9991 → 9.00 each
    expect(r.lines[0]).toEqual({ taxable: "99.99", cgst: "9.00", sgst: "9.00", igst: "0.00", total: "117.99" });
    expect([r.subtotal, r.cgstTotal, r.sgstTotal, r.igstTotal, r.total]).toEqual(["99.99", "9.00", "9.00", "0.00", "117.99"]);
  });

  it("inter-state: the whole rate as IGST", () => {
    const r = computeInvoiceTaxes([{ quantity: 3, unitPrice: "33.33", gstRatePercent: "18" }], "INTER_STATE")!;
    expect(r.lines[0]).toEqual({ taxable: "99.99", cgst: "0.00", sgst: "0.00", igst: "18.00", total: "117.99" });
    expect([r.cgstTotal, r.sgstTotal, r.igstTotal]).toEqual(["0.00", "0.00", "18.00"]);
  });

  it("CGST and SGST are always equal, and rounding is half-up (0.5 paisa goes up)", () => {
    // taxable 0.05, 10%: IGST 0.005 → 0.01 ; intra: half-rate 5% → 0.0025 → 0.00
    const intra = computeInvoiceTaxes([{ quantity: 1, unitPrice: "0.05", gstRatePercent: "10" }], "INTRA_STATE")!;
    expect([intra.lines[0]!.cgst, intra.lines[0]!.sgst]).toEqual(["0.00", "0.00"]);
    const inter = computeInvoiceTaxes([{ quantity: 1, unitPrice: "0.05", gstRatePercent: "10" }], "INTER_STATE")!;
    expect(inter.lines[0]!.igst).toBe("0.01");
    // taxable 1.00 at 5% intra: 2.5% = 0.025 → 0.03 each (half-up), total tax 0.06 — a paisa more than 5% of 1.00 (0.05)
    const half = computeInvoiceTaxes([{ quantity: 1, unitPrice: "1.00", gstRatePercent: "5" }], "INTRA_STATE")!;
    expect([half.cgstTotal, half.sgstTotal, half.total]).toEqual(["0.03", "0.03", "1.06"]);
    for (const price of ["1.00", "7.77", "123.45", "999.99", "0.01"]) {
      const x = computeInvoiceTaxes([{ quantity: 7, unitPrice: price, gstRatePercent: "12" }], "INTRA_STATE")!;
      expect(x.cgstTotal).toBe(x.sgstTotal);
    }
  });

  it("supports fractional rates and a zero rate", () => {
    const r = computeInvoiceTaxes([{ quantity: 1, unitPrice: "1000", gstRatePercent: "0.25" }, { quantity: 2, unitPrice: "50", gstRatePercent: "0" }, { quantity: 1, unitPrice: "200", gstRatePercent: "12.5" }], "INTER_STATE")!;
    expect(r.lines.map((l) => l.igst)).toEqual(["2.50", "0.00", "25.00"]);
    expect(r.byRate.map((x) => x.ratePercent)).toEqual(["0", "0.25", "12.5"]);
  });

  it("sums per line (not on the grand total) and groups by rate for the summary", () => {
    const r = computeInvoiceTaxes(
      [
        { quantity: 1, unitPrice: "0.05", gstRatePercent: "12" }, // 0.006 → 0.01 (IGST)
        { quantity: 1, unitPrice: "0.05", gstRatePercent: "12" },
        { quantity: 10, unitPrice: "100", gstRatePercent: "18" },
      ],
      "INTER_STATE",
    )!;
    expect(r.igstTotal).toBe("180.02"); // 0.01 + 0.01 + 180.00, not round(12% of 0.10) = 0.01
    expect(r.byRate).toEqual([
      { ratePercent: "12", taxable: "0.10", cgst: "0.00", sgst: "0.00", igst: "0.02" },
      { ratePercent: "18", taxable: "1000.00", cgst: "0.00", sgst: "0.00", igst: "180.00" },
    ]);
    expect(r.total).toBe("1180.12");
  });

  it("is exact for large values and refuses what it can not price (never a guess)", () => {
    const big = computeInvoiceTaxes([{ quantity: 100000, unitPrice: "9999.99", gstRatePercent: "18" }], "INTRA_STATE")!;
    expect([big.subtotal, big.cgstTotal, big.sgstTotal, big.total]).toEqual(["999999000.00", "89999910.00", "89999910.00", "1179998820.00"]);
    for (const bad of [{ quantity: 0, unitPrice: "1", gstRatePercent: "5" }, { quantity: 1.5, unitPrice: "1", gstRatePercent: "5" }, { quantity: 1, unitPrice: "abc", gstRatePercent: "5" }, { quantity: 1, unitPrice: "1", gstRatePercent: "101" }, { quantity: 1, unitPrice: "1", gstRatePercent: "" }]) {
      expect(computeInvoiceTaxes([bad], "INTRA_STATE"), JSON.stringify(bad)).toBeNull();
    }
    expect(computeInvoiceTaxes([], "INTRA_STATE")).toMatchObject({ subtotal: "0.00", total: "0.00", lines: [], byRate: [] });
  });
});

describe("amount in words", () => {
  it("uses Indian numbering", () => {
    expect(integerInWords(0n)).toBe("Zero");
    expect(integerInWords(7n)).toBe("Seven");
    expect(integerInWords(19n)).toBe("Nineteen");
    expect(integerInWords(40n)).toBe("Forty");
    expect(integerInWords(101n)).toBe("One Hundred One");
    expect(integerInWords(1000n)).toBe("One Thousand");
    expect(integerInWords(100000n)).toBe("One Lakh");
    expect(integerInWords(123456n)).toBe("One Lakh Twenty Three Thousand Four Hundred Fifty Six");
    expect(integerInWords(10000000n)).toBe("One Crore");
    expect(integerInWords(1234567890n)).toBe("One Hundred Twenty Three Crore Forty Five Lakh Sixty Seven Thousand Eight Hundred Ninety");
  });

  it("writes rupees and paise", () => {
    expect(amountInWords("1234.50")).toBe("Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only");
    expect(amountInWords("118.05")).toBe("Rupees One Hundred Eighteen and Five Paise Only");
    expect(amountInWords("5000.00")).toBe("Rupees Five Thousand Only");
    expect(amountInWords("0.99")).toBe("Rupees Zero and Ninety Nine Paise Only");
    expect(amountInWords("0.00")).toBe("Rupees Zero Only");
    expect(amountInWords("nonsense")).toBe("");
  });
});

describe("invoice number", () => {
  it("is INV/<yy-yy>/<sequence> and never longer than 16 characters, using only letters, digits, / and -", () => {
    expect(invoiceNumber("2026-27", 1)).toBe("INV/26-27/0001");
    expect(invoiceNumber("2026-27", 12)).toBe("INV/26-27/0012");
    expect(invoiceNumber("2099-00", 999)).toBe("INV/99-00/0999");
    for (const n of [1, 9999, 10000, 99999, MAX_INVOICE_SEQUENCE]) {
      const number = invoiceNumber("2026-27", n);
      expect(number.length, number).toBeLessThanOrEqual(16);
      expect(number).toMatch(/^[A-Za-z0-9/-]+$/);
    }
  });
  it("refuses an invalid year or a sequence outside 1..999999 instead of making a number that breaks the 16-character rule", () => {
    for (const bad of [0, -1, 1.5, MAX_INVOICE_SEQUENCE + 1]) expect(() => invoiceNumber("2026-27", bad)).toThrow();
    for (const year of ["26-27", "2026/27", "", "abcd-ef"]) expect(() => invoiceNumber(year, 1)).toThrow();
  });
});
