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
 *
 * ENQUIRY_DATA_DIR is looked up the way the website itself does it: the shell first, then
 * .env.production.local, .env.local, .env.production and .env in this folder. (Next loads those files;
 * a plain `node` script does not, so without this the viewer would look in the wrong place and report
 * "No enquiries yet" while leads were being saved elsewhere.)
 *
 * Only the newest part of the file (last 32 MB by default; `--max-bytes=N` to change) is read, so the
 * viewer keeps working even if the store has grown very large.
 */
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import path from "node:path";

// process.loadEnvFile never overrides a variable that is already set, so load in order of precedence.
if (typeof process.loadEnvFile === "function") {
  for (const name of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    try {
      process.loadEnvFile(path.join(process.cwd(), name));
    } catch {
      // file not present — fine
    }
  }
}

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

const maxBytes = Number(args.find((arg) => arg.startsWith("--max-bytes="))?.split("=")[1]) || 32 * 1024 * 1024;

/** Reads at most the last `maxBytes` of the file, dropping the first (probably cut-off) line when it had to cut. */
function readTail(filePath) {
  const fd = openSync(filePath, "r");
  try {
    const { size } = fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    readSync(fd, buffer, 0, buffer.length, start);
    let content = buffer.toString("utf8");
    if (start > 0) content = content.slice(content.indexOf("\n") + 1);
    return { content, size, cut: start > 0 };
  } finally {
    closeSync(fd);
  }
}

let raw;
let fileSize = 0;
let cut = false;
try {
  ({ content: raw, size: fileSize, cut } = readTail(file));
} catch (error) {
  if (error.code === "ENOENT") {
    console.log(`No enquiries yet (looked for ${file}).`);
    if (!process.env.ENQUIRY_DATA_DIR) {
      console.log("If the website saves enquiries somewhere else, set ENQUIRY_DATA_DIR (in the shell or .env.local) and run this again from the website's folder.");
    }
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
  if (cut) console.log(`The file is ${(fileSize / 1048576).toFixed(1)} MB: only the newest ${(maxBytes / 1048576).toFixed(1)} MB was read.`);
}
