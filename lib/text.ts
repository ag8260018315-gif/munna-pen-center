/**
 * Small, dependency-free text helpers shared by server and client code.
 *
 * JavaScript strings are UTF-16: an emoji such as 🙏 is TWO code units. Cutting a string with
 * `slice()` can therefore split one in half and leave a "lone surrogate", which makes
 * `encodeURIComponent` throw a URIError. Everything that shortens user text goes through here.
 */

const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

/** Replaces any lone (unpaired) surrogate with U+FFFD so the string is always safe to URL-encode. */
export function wellFormed(text: string): string {
  let out = "";
  for (const character of text) {
    // Iteration is by code point: a valid pair arrives as one character (code point > 0xFFFF),
    // an unpaired surrogate arrives alone with a code point inside the surrogate range.
    const codePoint = character.codePointAt(0) ?? 0;
    out += codePoint >= 0xd800 && codePoint <= 0xdfff ? REPLACEMENT_CHARACTER : character;
  }
  return out;
}

/**
 * Shortens `text` to at most `max` characters (Unicode code points, so an emoji is never split),
 * appending `ellipsis` when something was cut. Pass `""` for a plain hard cut.
 */
export function truncate(text: string, max: number, ellipsis = "…"): string {
  const characters = Array.from(wellFormed(text));
  if (characters.length <= max) return characters.join("");
  return characters.slice(0, Math.max(0, max - Array.from(ellipsis).length)).join("") + ellipsis;
}

/**
 * Cleans text typed by a visitor before it is validated or stored:
 *  - browsers submit textarea line breaks as CRLF; store plain "\n" (and count them as one character),
 *  - drops control characters (NUL, ESC, BEL, backspace, DEL, C1…) that have no business in a name or a
 *    message and can corrupt terminals, logs and CSV exports, keeping only newline and tab,
 *  - turns Unicode line / paragraph separators into ordinary newlines.
 */
export function sanitiseText(value: string): string {
  return wellFormed(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Zl}\p{Zp}]/gu, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "");
}
