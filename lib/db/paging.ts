/** A page number from the address bar, made safe: whole, at least 1, and not so large that the database rejects the offset ("?page=Infinity"). */
export function clampPage(page: number | null | undefined): number {
  const n = Number(page);
  return Number.isFinite(n) ? Math.min(10_000, Math.max(1, Math.floor(n))) : 1;
}
