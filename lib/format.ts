/** Up to two initials from a person's name, e.g. "Aoife Byrne" -> "AB". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-IE");

/** Group digits with thousands separators. Render inside a mono element. */
export function formatNumber(n: number): string {
  return NUMBER_FORMAT.format(n);
}

/** Points with a sign, e.g. +50 / -120. Useful for ledger rows. */
export function formatSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${NUMBER_FORMAT.format(Math.abs(n))}`;
}

/** "pt" / "pts" suffix helper. */
export function pts(n: number): string {
  return `${formatNumber(n)} ${Math.abs(n) === 1 ? "pt" : "pts"}`;
}

/**
 * Names for a sentence, collapsed once a list gets long:
 * ["Aoife"] -> ["Aoife"]; 5 names -> ["Aoife", "Cian", "Dara", "2 others"].
 * Pair with Intl.ListFormat for "Aoife, Cian, Dara and 2 others".
 */
export function shortNameList(names: string[], shown = 3): string[] {
  if (names.length <= shown + 1) return names;
  const rest = names.length - shown;
  return [...names.slice(0, shown), `${formatNumber(rest)} others`];
}
