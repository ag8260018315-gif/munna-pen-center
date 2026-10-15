/**
 * A small CSV reader (RFC 4180): quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF or LF,
 * a leading byte-order mark (Excel adds one to "CSV UTF-8"). It reads text only and never executes anything.
 */
export interface CsvResult {
  rows: string[][];
  /** Set when the file is not a usable CSV (e.g. an unterminated quote). */
  error?: string;
}

export function parseCsv(input: string): CsvResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnything = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // skip rows that are completely empty (a blank line, or a spreadsheet's trailing ",,,,")
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    sawAnything = true;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (inQuotes) return { rows: [], error: "The file has a quote mark that is never closed. Check the cell where it starts." };
  if (sawAnything && (field !== "" || row.length > 0)) endRow();
  return { rows };
}
