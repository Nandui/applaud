/**
 * How long a reward takes to reach someone, and where each claim is up to.
 * Pure functions only, shared by the server, the client and the unit tests.
 *
 * - Each reward can say how long fulfilment takes (Admin > Rewards), as an
 *   amount and a unit, e.g. 5 working days. Staff see it before claiming.
 * - A claim keeps the promise made when it was claimed (Redemption.expectedBy
 *   and fulfilmentLabel), so editing the reward later doesn't move it.
 * - Working days skip Saturdays and Sundays in Irish time. Bank holidays are
 *   not counted out, so set a little slack if that matters.
 * - Claim states: requested -> approved ("In progress") -> fulfilled, or
 *   cancelled (points refunded) at any point before fulfilled.
 */
import { ECONOMY_TIMEZONE, zonedDayStart } from "@/lib/economy";

export const FULFILMENT_UNITS = ["hours", "days", "working_days", "weeks"] as const;
export type FulfilmentUnit = (typeof FULFILMENT_UNITS)[number];

export const FULFILMENT_UNIT_LABELS: Record<FulfilmentUnit, string> = {
  hours: "Hours",
  days: "Days",
  working_days: "Working days",
  weeks: "Weeks",
};

/** The longest wait the form accepts, per unit. */
export const FULFILMENT_MAX: Record<FulfilmentUnit, number> = {
  hours: 72,
  days: 90,
  working_days: 60,
  weeks: 12,
};

export function isFulfilmentUnit(v: unknown): v is FulfilmentUnit {
  return typeof v === "string" && (FULFILMENT_UNITS as readonly string[]).includes(v);
}

const UNIT_WORDS: Record<FulfilmentUnit, [string, string]> = {
  hours: ["hour", "hours"],
  days: ["day", "days"],
  working_days: ["working day", "working days"],
  weeks: ["week", "weeks"],
};

/** "Within 5 working days", "Same day", or null when the reward doesn't say. */
export function fulfilmentLabel(amount: number | null, unit: string | null): string | null {
  if (amount === null || !isFulfilmentUnit(unit)) return null;
  if (amount <= 0) return unit === "hours" ? "Straight away" : "Same day";
  const [one, many] = UNIT_WORDS[unit];
  return `Within ${amount} ${amount === 1 ? one : many}`;
}

/** The local calendar day (year, month0, day, weekday 0=Sun) of `ref` in `tz`. */
function zonedDay(ref: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(ref);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year: Number(get("year")), month0: Number(get("month")) - 1, day: Number(get("day")), weekday };
}

/**
 * The moment a claim made at `from` should be fulfilled by: the end of the
 * last allowed day in Irish time (hours are counted exactly). Null when the
 * reward doesn't say how long it takes.
 */
export function expectedByDate(
  from: Date,
  amount: number | null,
  unit: string | null,
  tz: string = ECONOMY_TIMEZONE,
): Date | null {
  if (amount === null || !isFulfilmentUnit(unit)) return null;
  const n = Math.max(0, Math.floor(amount));
  if (unit === "hours") return new Date(from.getTime() + n * 3_600_000);

  const start = zonedDay(from, tz);
  let offset = 0; // calendar days after the claim day
  if (unit === "days") offset = n;
  else if (unit === "weeks") offset = n * 7;
  else {
    // Working days: count n weekdays after the claim day, so a weekend claim
    // starts counting on Monday. 0 ("same day") made at the weekend means Monday.
    const isWeekend = (d: number) => d === 0 || d === 6;
    let weekday = start.weekday;
    let counted = 0;
    const target = n === 0 && isWeekend(weekday) ? 1 : n;
    while (counted < target) {
      offset++;
      weekday = (weekday + 1) % 7;
      if (!isWeekend(weekday)) counted++;
    }
  }
  // End of that local day = start of the following one, minus a millisecond.
  return new Date(zonedDayStart(start.year, start.month0, start.day + offset + 1, tz).getTime() - 1);
}

export type ClaimStatus = "requested" | "approved" | "fulfilled" | "cancelled";

/** What staff and admins call each claim state. */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  requested: "Requested",
  approved: "In progress",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export function claimStatusLabel(status: string): string {
  return CLAIM_STATUS_LABELS[status as ClaimStatus] ?? status;
}

/** Still waiting on someone to do something. */
export function isOpenClaim(status: string): boolean {
  return status === "requested" || status === "approved";
}

/** An open claim past the date it was promised by. */
export function isOverdue(claim: { status: string; expectedBy: Date | null }, now: Date = new Date()): boolean {
  return isOpenClaim(claim.status) && claim.expectedBy !== null && claim.expectedBy.getTime() < now.getTime();
}

/** "Fri 7 Nov" (or "Fri 7 Nov, 14:00" for hour-based waits) in Irish time. */
export function expectedByLabel(date: Date, withTime = false, tz: string = ECONOMY_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  })
    .format(date)
    .replace(/,(?= \d+ )/, "");
}
