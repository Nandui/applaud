import { formatDistanceToNowStrict, format } from "date-fns";

/** "3h", "2d", "just now" style relative time for the feed. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 45_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** Full timestamp for tooltips, e.g. "24 Jun 2026, 14:03". */
export function fullTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "d MMM yyyy, HH:mm");
}

/** "June 2026" — for month headers. */
export function monthLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMMM yyyy");
}
