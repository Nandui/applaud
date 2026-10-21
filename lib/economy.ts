/**
 * The points economy: what a point is worth, when the month turns over, and
 * the suggested reward catalogue. Pure (no Prisma), so it is safe on the client
 * and easy to test.
 *
 * Two pots, two rules:
 *  - the GIVING allowance is per calendar month (Irish time) and anything left
 *    on the last day is simply gone, because usage is counted per month;
 *  - the WALLET (points received) never expires. Profile cosmetics cost the
 *    company nothing; real rewards carry a euro cost and draw on a monthly
 *    company-wide budget (OrgSettings.monthlyRewardBudgetCents).
 */

/**
 * Default conversion: 100 points = €1, so one point is one euro cent. Admins
 * can change it (OrgSettings.pointsPerEuro); euros only ever appear in Admin.
 */
export const DEFAULT_POINTS_PER_EURO = 100;

/** The cash value of `points` at `pointsPerEuro`, in euro cents. */
export function pointsToCents(points: number, pointsPerEuro: number = DEFAULT_POINTS_PER_EURO): number {
  return pointsPerEuro > 0 ? Math.round((points * 100) / pointsPerEuro) : 0;
}

/** Points that are worth `cents` at `pointsPerEuro`. */
export function centsToPoints(cents: number, pointsPerEuro: number = DEFAULT_POINTS_PER_EURO): number {
  return Math.round((cents * pointsPerEuro) / 100);
}

/** The org's month boundaries are Irish time, not the server's UTC. */
export const ECONOMY_TIMEZONE = "Europe/Dublin";

/** Shout-out amount shortcuts on the points keypad. */
export const POINT_PRESETS = [25, 50, 100] as const;

export function centsToEuros(cents: number): string {
  const euros = cents / 100;
  return `€${euros.toLocaleString("en-IE", {
    minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Parse an admin-typed euro amount ("4.50", "€45", "45,00") into cents. */
export function parseEurosToCents(raw: string): number | null {
  const cleaned = raw.replace(/[€\s]/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Offset of `tz` from UTC at instant `at`, in minutes (Dublin: 0 or +60). */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** The UTC instant of local midnight on the 1st of (year, month0) in `tz`. */
function zonedMonthStart(year: number, month0: number, tz: string): Date {
  const guess = new Date(Date.UTC(year, month0, 1));
  // Midnight local is `offset` minutes before midnight UTC. Re-check once in
  // case the offset differs on either side of the guess (DST never changes at
  // midnight in Dublin, but this keeps the helper honest for any zone).
  const first = new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60_000);
  return new Date(guess.getTime() - tzOffsetMinutes(first, tz) * 60_000);
}

/** The local (year, month0) that instant `ref` falls in. */
function zonedYearMonth(ref: Date, tz: string): { year: number; month0: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ref);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month0: Number(parts.find((p) => p.type === "month")?.value) - 1,
  };
}

/**
 * The economy month containing `ref`, as UTC instants: `gte` is local midnight
 * on the 1st, `lt` is local midnight on the 1st of the next month.
 */
export function economyMonth(
  ref: Date = new Date(),
  tz: string = ECONOMY_TIMEZONE,
): { gte: Date; lt: Date } {
  const { year, month0 } = zonedYearMonth(ref, tz);
  return {
    gte: zonedMonthStart(year, month0, tz),
    lt: zonedMonthStart(month0 === 11 ? year + 1 : year, (month0 + 1) % 12, tz),
  };
}

/** Whole days until the allowance and monthly stock reset (1 on the last day). */
export function daysUntilReset(ref: Date = new Date(), tz: string = ECONOMY_TIMEZONE): number {
  const { lt } = economyMonth(ref, tz);
  return Math.max(1, Math.ceil((lt.getTime() - ref.getTime()) / 86_400_000));
}

/** "1 November" — the date the month resets, for "back on …" copy. */
export function resetDateLabel(ref: Date = new Date(), tz: string = ECONOMY_TIMEZONE): string {
  const { lt } = economyMonth(ref, tz);
  return new Intl.DateTimeFormat("en-IE", { timeZone: tz, day: "numeric", month: "long" }).format(lt);
}

/** "resets in 9 days" / "resets tomorrow" / "resets tonight". */
export function resetsInLabel(ref: Date = new Date(), tz: string = ECONOMY_TIMEZONE): string {
  const days = daysUntilReset(ref, tz);
  if (days <= 1) return "resets tonight";
  if (days === 2) return "resets tomorrow";
  return `resets in ${days} days`;
}

type ShoutoutLimits = {
  maxPointsPerShoutoutStaff: number;
  maxPointsPerShoutoutManager: number;
};

/**
 * The most points one person can get from a single shout-out by this sender.
 * Stops two friends handing each other their whole allowance every month.
 * 0 means "no limit".
 */
export function maxPointsPerShoutout(role: string, settings: ShoutoutLimits): number {
  return role === "staff"
    ? settings.maxPointsPerShoutoutStaff
    : settings.maxPointsPerShoutoutManager;
}

export type EconomyInputs = {
  pointsPerEuro: number;
  monthlyRewardBudgetCents: number;
  monthlyAllowanceStaff: number;
  monthlyAllowanceManager: number;
  monthlyBonusPool: number;
};

/**
 * The budget maths for a month: the most points that could be created (every
 * allowance fully given plus the whole bonus pool), what that is worth in
 * cash, and how it compares with the rewards budget. The budget cap on claims
 * still protects the money when the worst case is higher.
 */
export function economyForecast(
  inputs: EconomyInputs,
  headcount: { staff: number; managers: number },
) {
  const staffPoints = headcount.staff * inputs.monthlyAllowanceStaff;
  const managerPoints = headcount.managers * inputs.monthlyAllowanceManager;
  const maxPoints = staffPoints + managerPoints + inputs.monthlyBonusPool;
  const maxCents = pointsToCents(maxPoints, inputs.pointsPerEuro);
  const people = headcount.staff + headcount.managers;
  return {
    staffPoints,
    managerPoints,
    bonusPoints: inputs.monthlyBonusPool,
    maxPoints,
    maxCents,
    /** Typical recognition apps see 40–60% of allowances given; plan on half. */
    typicalCents: Math.round(maxCents / 2),
    budgetPoints: centsToPoints(inputs.monthlyRewardBudgetCents, inputs.pointsPerEuro),
    overBudgetCents: Math.max(0, maxCents - inputs.monthlyRewardBudgetCents),
    budgetPerPersonCents: people > 0 ? Math.round(inputs.monthlyRewardBudgetCents / people) : 0,
  };
}

export type BudgetCheck =
  | { ok: true }
  | { ok: false; reason: "budget" | "monthlyStock" };

/**
 * Can one more of this reward be claimed this month? `spentCents` is the euro
 * cost of this month's live (not cancelled) claims across ALL rewards;
 * `claimedThisMonth` counts this reward's live claims this month.
 */
export function checkClaim(input: {
  euroCostCents: number;
  monthlyStock: number | null;
  claimedThisMonth: number;
  spentCents: number;
  budgetCents: number;
}): BudgetCheck {
  if (input.monthlyStock !== null && input.claimedThisMonth >= input.monthlyStock) {
    return { ok: false, reason: "monthlyStock" };
  }
  if (input.euroCostCents > 0 && input.spentCents + input.euroCostCents > input.budgetCents) {
    return { ok: false, reason: "budget" };
  }
  return { ok: true };
}

export type SuggestedReward = {
  name: string;
  description: string;
  category: string;
  pointsCost: number;
  euroCostCents: number;
  monthlyStock: number | null;
};

/**
 * The starter catalogue from the economy proposal. Bought items are priced at
 * face value (points / 100 = euros); in-house perks cost no cash and are held
 * in check by monthly stock alone. Admins load these from Admin > Rewards and
 * edit prices there.
 */
export const SUGGESTED_REWARDS: SuggestedReward[] = [
  { name: "Coffee", description: "Any coffee from the café.", category: "Treats", pointsCost: 300, euroCostCents: 300, monthlyStock: 40 },
  { name: "Smoothie or protein shake", description: "Fresh from the café.", category: "Treats", pointsCost: 450, euroCostCents: 450, monthlyStock: 20 },
  { name: "Coffee and a pastry", description: "A coffee with something sweet.", category: "Treats", pointsCost: 500, euroCostCents: 500, monthlyStock: 20 },
  { name: "Lunch voucher", description: "€10 off lunch.", category: "Treats", pointsCost: 1000, euroCostCents: 1000, monthlyStock: 10 },
  { name: "Guest day pass", description: "A free day pass for a friend or family member.", category: "Perks", pointsCost: 600, euroCostCents: 0, monthlyStock: 10 },
  { name: "First pick of shifts", description: "First pick of shifts on the next rota.", category: "Perks", pointsCost: 800, euroCostCents: 0, monthlyStock: 4 },
  { name: "PT session", description: "A one-to-one session with a personal trainer.", category: "Perks", pointsCost: 1500, euroCostCents: 0, monthlyStock: 4 },
  { name: "Finish an hour early", description: "Agree the day with your manager.", category: "Perks", pointsCost: 2000, euroCostCents: 0, monthlyStock: 4 },
  { name: "Extra half-day off", description: "An extra half-day of leave.", category: "Perks", pointsCost: 6000, euroCostCents: 0, monthlyStock: 2 },
  { name: "Cinema for two", description: "Two cinema tickets.", category: "Big ones", pointsCost: 2000, euroCostCents: 2000, monthlyStock: 4 },
  { name: "Branded hoodie", description: "A cosy branded hoodie in your size.", category: "Big ones", pointsCost: 3000, euroCostCents: 3000, monthlyStock: 4 },
  { name: "Spa visit", description: "A spa visit to unwind.", category: "Big ones", pointsCost: 4500, euroCostCents: 4500, monthlyStock: 3 },
  { name: "60-minute massage", description: "A full hour's massage.", category: "Big ones", pointsCost: 6000, euroCostCents: 6000, monthlyStock: 2 },
];
