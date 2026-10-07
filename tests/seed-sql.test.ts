import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { q, renderSeedSql } from "@/scripts/generate-seed-sql";

describe("prisma/seed/catalogue.sql (pasted into the Supabase SQL Editor)", () => {
  it("is exactly what `npm run db:seed-sql` generates from data/ — regenerate it if this fails", async () => {
    expect(await readFile("prisma/seed/catalogue.sql", "utf8")).toBe(renderSeedSql());
  });

  it("contains only the owner-supplied rows and only create-only inserts", () => {
    const sql = renderSeedSql();
    expect((sql.match(/ON CONFLICT \("slug"\) DO NOTHING/g) ?? []).length).toBe(3);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/);
    // Not one of the business values the owner has not supplied.
    for (const column of ["sku", "purchasePrice", "wholesalePrice", "retailPrice", "hsnCode", "gstRatePercent", "stockQuantity", "minOrderQuantity", "brandId", "packSize", "unit"]) {
      expect(sql, column).not.toMatch(new RegExp(`"${column}"`));
    }
    expect(sql).not.toMatch(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/); // no GSTIN
    expect(sql).not.toMatch(/₹|\bRs\.?\s?\d/);
    // Every row of the data is present.
    for (const c of categories) expect(sql).toContain(`'${c.slug}'`);
    for (const b of brands) expect(sql).toContain(`'${b.slug}'`);
    for (const p of products) expect(sql).toContain(`'${p.slug}'`);
  });

  it("quotes values safely, so a name like O'Neil cannot break — or inject into — the SQL", () => {
    expect(q("O'Neil")).toBe("'O''Neil'");
    expect(q(`'; DROP TABLE "Product"; --`)).toBe(`'''; DROP TABLE "Product"; --'`);
    expect(q("")).toBe("''");
  });

  it("writes anything that is not plain ASCII as chr(...), so the file survives copy and paste byte for byte", () => {
    expect(q("a \u2014 b")).toBe("'a ' || chr(8212) || ' b'");
    expect(q("line1\nline2")).toBe("'line1' || chr(10) || 'line2'");
    expect(q("\u00e9")).toBe("chr(233)");
  });
});
