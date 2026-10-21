import { formatDistanceToNowStrict, format } from "date-fns";

/** "3h", "2d", "just now" style relative time for the feed. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 45_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** Threads-style compact age: "now", "5m", "3h", "2d", "3w", then "12 Mar". */
export function shortTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  if (s < 5 * 7 * 86_400) return `${Math.floor(s / (7 * 86_400))}w`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? "d MMM" : "d MMM yyyy");
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
