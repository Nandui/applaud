import { ECONOMY_TIMEZONE, zonedDayStart } from "@/lib/economy";

// Client-safe (no Prisma): the award vote schedule maths, shared by the admin
// form, the vote settings dialog, the server actions and the opener.

export const VOTE_INTERVALS = ["week", "month", "quarter"] as const;
export type VoteInterval = (typeof VOTE_INTERVALS)[number];

export const VOTE_INTERVAL_LABELS: Record<VoteInterval, string> = {
  week: "Every week",
  month: "Every month",
  quarter: "Every quarter",
};

/** Roles that can be put in charge of an award's vote (admins always are). */
export const VOTE_ROLES = ["admin", "manager", "operations", "ceo"] as const;
export type VoteRole = (typeof VOTE_ROLES)[number];

export const VOTE_ROLE_LABELS: Record<VoteRole, string> = {
  admin: "Admins only",
  manager: "Managers",
  operations: "Operations",
  ceo: "CEO",
};

export const MIN_VOTE_DAYS = 1;
export const MAX_VOTE_DAYS = 28;

/** Votes open at this hour, Irish time. */
export const VOTE_OPEN_HOUR = 9;

export function isVoteInterval(v: unknown): v is VoteInterval {
  return typeof v === "string" && (VOTE_INTERVALS as readonly string[]).includes(v);
}

export function isVoteRole(v: unknown): v is VoteRole {
  return typeof v === "string" && (VOTE_ROLES as readonly string[]).includes(v);
}

/** Admins run every vote; otherwise the award's chosen role does. */
export function canRunVote(role: string, voteRole: string): boolean {
  return role === "admin" || role === voteRole;
}

type LocalDate = { year: number; month0: number; day: number };

/** The Irish calendar date that instant `at` falls on. */
export function localDate(at: Date, tz: string = ECONOMY_TIMEZONE): LocalDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month0: get("month") - 1, day: get("day") };
}

/** 09:00 Irish time on a calendar date. */
export function openingInstant(d: LocalDate, tz: string = ECONOMY_TIMEZONE): Date {
  const midnight = zonedDayStart(d.year, d.month0, d.day, tz);
  return new Date(midnight.getTime() + VOTE_OPEN_HOUR * 3_600_000);
}

/** "2026-11-01" in a date input -> 09:00 Irish time that day; null if not a date. */
export function parseOpeningDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = { year: Number(m[1]), month0: Number(m[2]) - 1, day: Number(m[3]) };
  if (d.month0 < 0 || d.month0 > 11 || d.day < 1 || d.day > daysInMonth(d.year, d.month0)) return null;
  return openingInstant(d);
}

/** The value for a date input showing the Irish date of `at`. */
export function toDateInput(at: Date | null | undefined): string {
  if (!at) return "";
  const d = localDate(at);
  return `${d.year}-${String(d.month0 + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** One interval after a calendar date; the 31st becomes the month's last day. */
function addInterval(d: LocalDate, every: VoteInterval): LocalDate {
  if (every === "week") {
    const t = new Date(Date.UTC(d.year, d.month0, d.day + 7));
    return { year: t.getUTCFullYear(), month0: t.getUTCMonth(), day: t.getUTCDate() };
  }
  const months = every === "month" ? 1 : 3;
  const total = d.year * 12 + d.month0 + months;
  const year = Math.floor(total / 12);
  const month0 = total % 12;
  return { year, month0, day: Math.min(d.day, daysInMonth(year, month0)) };
}

/**
 * When the vote after one opening at `from` opens. Skips any openings already
 * in the past (`now`), so a schedule that was missed for a while opens once,
 * not once per missed period.
 */
export function nextOpening(from: Date, every: VoteInterval, now: Date = new Date()): Date {
  let d = addInterval(localDate(from), every);
  let at = openingInstant(d);
  while (at.getTime() <= now.getTime()) {
    d = addInterval(d, every);
    at = openingInstant(d);
  }
  return at;
}

/**
 * The first opening for a newly turned-on schedule: the start of the next
 * week (Monday), month or quarter, at 09:00 Irish time.
 */
export function firstOpening(every: VoteInterval, now: Date = new Date()): Date {
  const today = localDate(now);
  let d: LocalDate;
  if (every === "week") {
    const weekday = new Date(Date.UTC(today.year, today.month0, today.day)).getUTCDay(); // 0 = Sunday
    const ahead = ((8 - weekday) % 7) || 7;
    const t = new Date(Date.UTC(today.year, today.month0, today.day + ahead));
    d = { year: t.getUTCFullYear(), month0: t.getUTCMonth(), day: t.getUTCDate() };
  } else {
    const step = every === "month" ? 1 : 3;
    const startOfPeriod = today.month0 - (today.month0 % step);
    const total = today.year * 12 + startOfPeriod + step;
    d = { year: Math.floor(total / 12), month0: total % 12, day: 1 };
  }
  return openingInstant(d);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The name of a vote opening at `at`: "November 2026", "Week of 3 Nov", "Q4 2026". */
export function roundLabel(at: Date, every: VoteInterval | null): string {
  const d = localDate(at);
  if (every === "week") return `Week of ${d.day} ${MONTHS[d.month0].slice(0, 3)}`;
  if (every === "quarter") return `Q${Math.floor(d.month0 / 3) + 1} ${d.year}`;
  return `${MONTHS[d.month0]} ${d.year}`;
}

/** "Fri 7 Nov, 09:00" in Irish time. */
export function voteTimeLabel(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: ECONOMY_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "every month · next vote Mon 1 Dec, 09:00" for an award's schedule line. */
export function scheduleSummary(every: string | null, nextVoteAt: Date | string | null): string | null {
  if (!isVoteInterval(every)) return null;
  const base = VOTE_INTERVAL_LABELS[every];
  return nextVoteAt ? `${base} · next vote ${voteTimeLabel(nextVoteAt)}` : base;
}
