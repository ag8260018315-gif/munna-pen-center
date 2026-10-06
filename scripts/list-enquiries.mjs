#!/usr/bin/env node
/**
 * Prints the enquiries saved by the website (V1 file store), newest first.
 *
 *   npm run enquiries              # table
 *   npm run enquiries -- --json    # raw JSON
 *   npm run enquiries -- 5         # only the latest 5
 *
 * Reads `$ENQUIRY_DATA_DIR/enquiries.jsonl` (default: ./.data). It only reads — nothing is changed.
 * This stands in for the admin "Enquiries" screen until the database is connected.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const limit = Number(args.find((arg) => /^\d+$/.test(arg))) || 50;
const file = path.join(process.env.ENQUIRY_DATA_DIR || path.join(process.cwd(), ".data"), "enquiries.jsonl");

let raw;
try {
  raw = readFileSync(file, "utf8");
} catch (error) {
  if (error.code === "ENOENT") {
    console.log(`No enquiries yet (looked for ${file}).`);
    process.exit(0);
  }
  throw error;
}

const enquiries = raw
  .split("\n")
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  })
  .reverse()
  .slice(0, limit);

if (asJson) {
  console.log(JSON.stringify(enquiries, null, 2));
} else if (enquiries.length === 0) {
  console.log("No enquiries yet.");
} else {
  for (const e of enquiries) {
    const when = new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    console.log(`\n${e.reference}  ·  ${when}  ·  ${e.source}`);
    console.log(`  ${e.name}${e.organization ? ` (${e.organization})` : ""}  ·  ${e.phone}${e.email ? `  ·  ${e.email}` : ""}`);
    if (e.city || e.state) console.log(`  ${[e.city, e.state].filter(Boolean).join(", ")}`);
    console.log(`  Products: ${String(e.productsRequired).replace(/\n/g, " | ")}`);
    if (e.approximateQuantity) console.log(`  Quantity: ${e.approximateQuantity}`);
    if (e.additionalRequirements) console.log(`  Notes: ${e.additionalRequirements}`);
  }
  console.log(`\n${enquiries.length} enquir${enquiries.length === 1 ? "y" : "ies"} shown. File: ${file}`);
}
