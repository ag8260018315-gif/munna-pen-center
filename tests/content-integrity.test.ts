import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the owner's rule: "Do not invent fake company history, reviews, customers, certifications,
 * addresses, statistics, prices or stock." Scans everything a visitor can read and fails on wording that
 * would make a claim the business has not confirmed. If you REALLY have a confirmed fact, put it in
 * lib/config/site.ts or content/*.ts and adjust the pattern deliberately.
 */

const ROOTS = ["app", "components", "content", "data", "lib/config"];
const EXTENSIONS = /\.(tsx?|json)$/;
const SKIP = /(^|\/)(admin|actions)(\/|$)|opengraph-image|global-error/; // admin copy is internal; OG image has its own checks

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\b\d{1,3}(,\d{3})*\+?\s+(years?|happy|satisfied|customers|clients|orders|products|schools|stores)\b/i, why: "invented statistic" },
  { pattern: /\b(since|established in|founded in|est\.?)\s+(19|20)\d{2}\b/i, why: "invented founding year" },
  { pattern: /testimonial|what our (customers|clients) say|five.star|★|⭐/i, why: "reviews / testimonials" },
  { pattern: /\bISO\s?\d{3,}|\bcertified\b|\baward[- ]winning\b|\bBIS\b|\bFSSAI\b/i, why: "certification / award claim" },
  { pattern: /₹\s?\d|\bRs\.?\s?\d|\bINR\s?\d|\bMRP\b|\b\d+\s?%\s?off\b|lowest price|best price|cheapest/i, why: "price / discount claim" },
  { pattern: /\bin stock\b|\bout of stock\b|\b\d+\s+(units?|pcs|pieces)\s+(left|available)\b/i, why: "stock claim" },
  { pattern: /same[- ]day|next[- ]day|\b\d+\s?(-|to)?\s?\d*\s?(hours?|business days?|working days?)\b|free (shipping|delivery)|guaranteed delivery/i, why: "delivery-time / free-delivery promise" },
  { pattern: /\bGSTIN[:\s]+\d{2}[A-Z]{5}\d{4}[A-Z]/i, why: "hard-coded GSTIN" },
  // The owner named these customer groups: schools, offices, engineers, businesses, institutions, retailers.
  // Examples beyond that list are invented specifics.
  { pattern: /\b(hospitals?|coaching|colleges?|universit(?:y|ies)|government offices?|\btrusts\b|ngos?)\b/i, why: "customer type the owner did not name" },
  { pattern: /one-off retail|not (?:for )?retail|minimum order|\bMOQ\b|credit terms?|cash on delivery/i, why: "sales policy the owner did not state" },
  { pattern: /every state|each state|all (?:pin ?codes|districts)|every (?:city|town|district)|pan[- ]india network/i, why: "coverage claim beyond 'across India'" },
  { pattern: /available for bulk|in stock|ready stock|immediately available/i, why: "availability claim" },
  { pattern: /everything your organi[sz]ation/i, why: "range over-claim" },
];

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else if (EXTENSIONS.test(entry.name) && !SKIP.test(full)) out.push(full);
  }
  return out;
}

describe("visitor-facing content makes no unconfirmed claims", () => {
  it("scans a meaningful number of files", async () => {
    const all = (await Promise.all(ROOTS.map(files))).flat();
    expect(all.length).toBeGreaterThan(40);
  });

  it("contains none of the forbidden claim patterns", async () => {
    const all = (await Promise.all(ROOTS.map(files))).flat();
    const hits: string[] = [];
    for (const file of all) {
      const source = await readFile(file, "utf8");
      // Ignore code comments so documentation about the rules doesn't trip the scan.
      const visible = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const { pattern, why } of FORBIDDEN) {
        const match = pattern.exec(visible);
        if (match) hits.push(`${file}: ${why} — "${match[0]}"`);
      }
    }
    expect(hits).toEqual([]);
  });
});
