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

/** One pass: every line loses the marker however often it is repeated at its start, then the whole text is trimmed. */
function stripMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let clean = line;
      while (clean.startsWith(LOG)) clean = clean.slice(LOG.length);
      return clean;
    })
    .join("\n")
    .trim();
}

/**
 * What staff typed, made safe: no line may start with the log marker. One pass is not enough — trimming can expose a new marker
 * ("[log]  [log] x" becomes "[log] x" once the stray space goes) — so it repeats until nothing changes.
 */
export function cleanUserNotes(text: string | null | undefined): string {
  let current = (text ?? "").trim();
  for (let pass = 0; pass < 100; pass++) {
    const next = stripMarkers(current);
    if (next === current) return current;
    current = next;
  }
  // Unreachable (each pass either shortens the text or leaves it unchanged), but never return something that could pass as a log line.
  return current.replaceAll(LOG, "");
}

export function joinNotes(text: string, log: readonly string[]): string | null {
  const joined = [text, ...log].filter((part) => part !== "").join("\n");
  return joined === "" ? null : joined;
}

/** One log line: dated (in the caller's day), by whom, what. Newlines are flattened so it stays one line. */
export function logLine(day: string, who: string, what: string): string {
  return `${LOG}${day} ${who}: ${what}`.replace(/[\r\n]+/g, " ").slice(0, 600);
}
