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

/**
 * Visitors control every field, so print them as inert single-line text: line breaks become " | " (a
 * visitor can't fake a second enquiry row) and every control character is dropped (a visitor can't send
 * terminal escape sequences to the owner's screen).
 */
const text = (value) =>
  String(value ?? "")
    .replace(/\r\n|\r|\n|[\p{Zl}\p{Zp}]/gu, " | ")
    .replace(/\p{Cc}/gu, " ");

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
    console.log(`\n${text(e.reference)}  ·  ${text(when)}  ·  ${text(e.source)}`);
    console.log(`  ${text(e.name)}${e.organization ? ` (${text(e.organization)})` : ""}  ·  ${text(e.phone)}${e.email ? `  ·  ${text(e.email)}` : ""}`);
    if (e.city || e.state) console.log(`  ${text([e.city, e.state].filter(Boolean).join(", "))}`);
    console.log(`  Products: ${text(e.productsRequired)}`);
    if (e.approximateQuantity) console.log(`  Quantity: ${text(e.approximateQuantity)}`);
    if (e.additionalRequirements) console.log(`  Notes: ${text(e.additionalRequirements)}`);
  }
  console.log(`\n${enquiries.length} enquir${enquiries.length === 1 ? "y" : "ies"} shown. File: ${file}`);
}
