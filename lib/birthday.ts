/**
 * Birthdays. Each person adds their own date of birth once (the app tour, a
 * Home card or Edit profile) and can't change it afterwards; an admin can
 * correct it in Admin > Users. Birthday points are the "Birthday" rule in
 * Admin > Milestones, paid by the daily milestone job on the day.
 *
 * Client-safe: no database access here.
 */

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Youngest and oldest age we accept, so a slip of the year picker is caught. */
export const MIN_AGE = 14;
export const MAX_AGE = 100;

/** localStorage key: when the person last said "Not now" to the Home card. */
export const BIRTHDAY_CARD_SNOOZED_KEY = "yayup:birthday-card-snoozed";
/** The Home card comes back this many days after "Not now". */
export const BIRTHDAY_CARD_SNOOZE_DAYS = 14;

export function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type BirthdayParts = { day: number; month: number; year: number };

/** "YYYY-MM-DD" for the parts, or null when the date doesn't exist. */
export function isoFromParts({ day, month, year }: BirthdayParts): string | null {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Checks a "YYYY-MM-DD" date of birth: a real date, and an age between
 * MIN_AGE and MAX_AGE on `today`. Returns the UTC-midnight Date or an error.
 */
export function checkBirthday(
  iso: string,
  today: Date = new Date(),
): { ok: true; date: Date } | { ok: false; error: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return { ok: false, error: "Pick a day, month and year." };
  const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  if (!isoFromParts(parts)) return { ok: false, error: "That date doesn't exist." };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const age = ageOn(date, today);
  if (age < MIN_AGE) return { ok: false, error: "Check the year: that makes you too young." };
  if (age > MAX_AGE) return { ok: false, error: "Check the year: that's over 100 years ago." };
  return { ok: true, date };
}

function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const m = today.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/** "14 March 1999". */
export function formatBirthday(date: Date | string, withYear = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${base} ${d.getUTCFullYear()}` : base;
}

/**
 * Is `birthday` celebrated on `day`? Same month and day; a 29 February
 * birthday is celebrated on 28 February in years without a 29th.
 */
export function isBirthdayOn(birthday: Date, day: Date): boolean {
  const bm = birthday.getUTCMonth();
  const bd = birthday.getUTCDate();
  if (bm === day.getUTCMonth() && bd === day.getUTCDate()) return true;
  const leap = daysInMonth(day.getUTCFullYear(), 2) === 29;
  return bm === 1 && bd === 29 && !leap && day.getUTCMonth() === 1 && day.getUTCDate() === 28;
}
