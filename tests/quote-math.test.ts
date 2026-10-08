import { describe, expect, it } from "vitest";
import { computeQuote, financialYearOf, fromPaise, quotationNumber, rateToBasisPoints, toPaise } from "@/lib/domain/quote-math";

describe("money in paise", () => {
  it("parses and prints exactly", () => {
    expect(toPaise("1250.5")).toBe(125050n);
    expect(toPaise("0.07")).toBe(7n);
    expect(toPaise("12")).toBe(1200n);
    for (const bad of ["", "abc", "-1", "1.234", "1,000", "12345678901", null, undefined]) expect(toPaise(bad as never), String(bad)).toBeNull();
    expect(fromPaise(125050n)).toBe("1250.50");
    expect(fromPaise(7n)).toBe("0.07");
    expect(fromPaise(0n)).toBe("0.00");
  });
  it("reads GST rates to two decimals, max 100", () => {
    expect(rateToBasisPoints("18")).toBe(1800n);
    expect(rateToBasisPoints("12.5")).toBe(1250n);
    expect(rateToBasisPoints("0")).toBe(0n);
    expect(rateToBasisPoints("100")).toBe(10000n);
    for (const bad of ["101", "-1", "x", "", "1.234", null]) expect(rateToBasisPoints(bad as never), String(bad)).toBeNull();
  });
});

describe("quotation totals", () => {
  it("adds GST on top of ex-GST prices, rounding each line half-up to the paisa", () => {
    const q = computeQuote([
      { quantity: 3, unitPrice: "33.33", gstRatePercent: "18" }, // 99.99 → tax 17.9982 → 18.00
      { quantity: 1, unitPrice: "0.05", gstRatePercent: "12" }, // 0.05 → 0.006 → 0.01 (half-up per line)
    ]);
    expect(q.lines).toEqual([{ lineTotal: "99.99", tax: "18.00" }, { lineTotal: "0.05", tax: "0.01" }]);
    expect(q.subtotal).toBe("100.04");
    expect(q.taxTotal).toBe("18.01");
    expect(q.total).toBe("118.05");
  });
  it("rounds exactly half up (not to even)", () => {
    expect(computeQuote([{ quantity: 1, unitPrice: "0.25", gstRatePercent: "10" }]).taxTotal).toBe("0.03"); // 0.025 → 0.03
  });
  it("has NO totals while any line lacks a price or a GST rate — never a made-up number", () => {
    const priced = { quantity: 2, unitPrice: "10", gstRatePercent: "18" };
    expect(computeQuote([]).total).toBeNull();
    expect(computeQuote([priced, { quantity: 1, unitPrice: null, gstRatePercent: "18" }]).total).toBeNull();
    const noGst = computeQuote([priced, { quantity: 1, unitPrice: "5", gstRatePercent: null }]);
    expect(noGst.total).toBeNull();
    expect(noGst.lines[1]).toEqual({ lineTotal: "5.00", tax: null });
    expect(computeQuote([{ quantity: 1, unitPrice: "0", gstRatePercent: "0" }]).total).toBe("0.00");
  });
  it("is exact for large values and flags amounts the database can not hold", () => {
    // 100,000 × 9,999.99 = 999,999,000.00; GST 18% = 179,999,820.00
    expect(computeQuote([{ quantity: 100_000, unitPrice: "9999.99", gstRatePercent: "18" }])).toMatchObject({ subtotal: "999999000.00", taxTotal: "179999820.00", total: "1179998820.00", overflow: false });
    // the TOTAL (not just the subtotal) must fit the Decimal(12,2) column
    expect(computeQuote([{ quantity: 1_000_000, unitPrice: "9999.99", gstRatePercent: "18" }])).toMatchObject({ overflow: true, total: null });
    const big = computeQuote([{ quantity: 9_000_000, unitPrice: "9999999999.99", gstRatePercent: "18" }]);
    expect(big.overflow).toBe(true);
    expect(big.total).toBeNull();
  });
  it("rejects a non-positive or fractional quantity as incomplete", () => {
    expect(computeQuote([{ quantity: 0, unitPrice: "1", gstRatePercent: "5" }]).total).toBeNull();
    expect(computeQuote([{ quantity: 1.5, unitPrice: "1", gstRatePercent: "5" }]).total).toBeNull();
  });
});

describe("financial year and numbering", () => {
  it("runs April to March in Indian time", () => {
    expect(financialYearOf(new Date("2026-04-01T00:00:00+05:30"))).toBe("2026-27");
    expect(financialYearOf(new Date("2026-03-31T23:59:00+05:30"))).toBe("2025-26");
    expect(financialYearOf(new Date("2026-10-08T10:00:00Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2026-03-31T19:00:00Z"))).toBe("2026-27"); // already 1 April in India
    expect(financialYearOf(new Date("2099-12-31T00:00:00Z"))).toBe("2099-00");
  });
  it("formats quotation numbers", () => {
    expect(quotationNumber("2026-27", 7)).toBe("QT-2026-27-0007");
    expect(quotationNumber("2026-27", 12345)).toBe("QT-2026-27-12345");
  });
});
