/** Locale-independent string order (by UTF-16 code unit), used for deterministic output. */
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
