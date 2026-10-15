/**
 * An order's "internal notes" hold two kinds of lines: what staff typed, and system log lines ("[log] 2026-10-16 Asha: invoice
 * INV/26-27/0001 voided — wrong customer"). Staff edit the first kind; the second can not be removed or forged through the form,
 * because it is split off before the notes are shown and joined back on when they are saved.
 */
const LOG = "[log] ";

export function splitNotes(notes: string | null | undefined): { text: string; log: string[] } {
  const text: string[] = [];
  const log: string[] = [];
  for (const line of (notes ?? "").split("\n")) (line.startsWith(LOG) ? log : text).push(line);
  return { text: text.join("\n").trim(), log };
}

/** What staff typed, made safe: a line that starts like a log line loses that start so it can not pass as one. */
export function cleanUserNotes(text: string | null | undefined): string {
  return (text ?? "")
    .split("\n")
    .map((line) => {
      // Strip the marker however many times it is repeated ("[log] [log] …"): one pass would leave a fresh marker behind.
      let clean = line;
      while (clean.startsWith(LOG)) clean = clean.slice(LOG.length);
      return clean;
    })
    .join("\n")
    .trim();
}

export function joinNotes(text: string, log: readonly string[]): string | null {
  const joined = [text, ...log].filter((part) => part !== "").join("\n");
  return joined === "" ? null : joined;
}

/** One log line: dated (in the caller's day), by whom, what. Newlines are flattened so it stays one line. */
export function logLine(day: string, who: string, what: string): string {
  return `${LOG}${day} ${who}: ${what}`.replace(/[\r\n]+/g, " ").slice(0, 400);
}
