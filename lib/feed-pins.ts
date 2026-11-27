/**
 * Pinning a recognition or post to the top of the Home feed for a while.
 *
 * Who can pin: points rank Manager, Centre manager, Operations manager or CEO,
 * and app admins. A pin shows at the top of everyone's feed (a poll or question
 * limited to some sites still only shows to those sites) until its end time,
 * then the card drops back to its normal place on its own: nothing needs to
 * run, the feed just ignores pins whose time has passed.
 *
 * Who can unpin or change a pin: the person who pinned it, and admins.
 *
 * Client-safe: no database imports.
 */

import { zonedDayStart, ECONOMY_TIMEZONE } from "@/lib/economy";

/** Points ranks that can pin to the feed (admins can too, whatever their rank). */
export const FEED_PIN_RANKS = ["manager", "centre_manager", "operations", "ceo"] as const;

/** At most this many things pinned at once, so the feed is still a feed. */
export const MAX_FEED_PINS = 3;

/** Longest a pin can last. */
export const MAX_PIN_DAYS = 31;

export const PIN_DURATIONS = [
  { key: "1d", label: "1 day", days: 1 },
  { key: "3d", label: "3 days", days: 3 },
  { key: "1w", label: "1 week", days: 7 },
  { key: "2w", label: "2 weeks", days: 14 },
] as const;

export type PinDurationKey = (typeof PIN_DURATIONS)[number]["key"];

/** A preset length, or "until the end of this day" as YYYY-MM-DD (Irish time). */
export type PinChoice = { duration: PinDurationKey } | { untilDate: string };

export function canPinToFeed(user: { role: string; pointsRank?: string | null }): boolean {
  return user.role === "admin" || (FEED_PIN_RANKS as readonly string[]).includes(user.pointsRank ?? "");
}

/** Can this person take a pin down (or change how long it stays)? */
export function canUnpinFromFeed(
  user: { id: string; role: string },
  pinnedById: string | null,
): boolean {
  return user.role === "admin" || (pinnedById !== null && pinnedById === user.id);
}

/** Is a pin with this end time still showing? */
export function isPinActive(until: Date | null | undefined, now: Date = new Date()): boolean {
  return !!until && until.getTime() > now.getTime();
}

/** Today's date in Irish time as YYYY-MM-DD (for the date picker's minimum). */
export function todayInDublin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ECONOMY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * When a pin made now with this choice ends, or an error message. A date pin
 * lasts to the end of that day, Irish time.
 */
export function pinEndsAt(choice: PinChoice, now: Date = new Date()): { ok: true; until: Date } | { ok: false; error: string } {
  let until: Date;
  if ("duration" in choice) {
    const preset = PIN_DURATIONS.find((d) => d.key === choice.duration);
    if (!preset) return { ok: false, error: "Pick how long to pin it for." };
    until = new Date(now.getTime() + preset.days * 86_400_000);
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(choice.untilDate);
    if (!m) return { ok: false, error: "Pick a date." };
    const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
    const check = new Date(Date.UTC(y, mo, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo || check.getUTCDate() !== d) {
      return { ok: false, error: "Pick a real date." };
    }
    until = zonedDayStart(y, mo, d + 1);
    if (until.getTime() <= now.getTime()) return { ok: false, error: "Pick today or a later date." };
  }
  if (until.getTime() - now.getTime() > MAX_PIN_DAYS * 86_400_000 + 86_400_000) {
    return { ok: false, error: `A pin can last ${MAX_PIN_DAYS} days at most.` };
  }
  return { ok: true, until };
}

/**
 * "until 9pm" (today), "until tomorrow 9pm", "until Fri 5 Dec", Irish time.
 * A pin ending at midnight reads as the day before ("until Fri" = all of Friday).
 */
export function pinUntilLabel(until: Date, now: Date = new Date()): string {
  const tz = ECONOMY_TIMEZONE;
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-IE", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .format(until)
    .replace(":00", "")
    .replace(/\s/g, "")
    .toLowerCase();
  const isMidnight = time === "12am";
  // A midnight end means "the end of the previous day".
  const shown = isMidnight ? new Date(until.getTime() - 60_000) : until;
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const shownDay = dayKey(shown);
  if (shownDay === today) return isMidnight ? "until tonight" : `until ${time}`;
  if (shownDay === tomorrow) return isMidnight ? "until tomorrow" : `until tomorrow ${time}`;
  const date = new Intl.DateTimeFormat("en-IE", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(shown);
  return `until ${date.replace(",", "")}`;
}
