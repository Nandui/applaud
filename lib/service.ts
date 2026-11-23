/**
 * Length of service: each person's start date (User.hireDate, set in
 * Admin > Users) earns them a service medal at 6 months, then every year up
 * to 5, then at 10, 15 and 20 years, each in a rarer metal. The early steps
 * are close together because many people stay a few years. Shown big on
 * their profile and small next to their name in the feed
 * (components/service-medal.tsx).
 */

export type ServiceTierKey =
  | "steel"
  | "bronze"
  | "copper"
  | "silver"
  | "rosegold"
  | "gold"
  | "platinum"
  | "diamond"
  | "legend";

export type ServiceTier = {
  key: ServiceTierKey;
  /** Whole months of service this medal is earned at. */
  months: number;
  /** The metal, as people see it ("Gold"). */
  name: string;
  /** Its signature colour, for the plaque and labels around the medal. */
  accent: string;
};

export const SERVICE_TIERS: readonly ServiceTier[] = [
  { key: "steel", months: 6, name: "Steel", accent: "#6d7887" },
  { key: "bronze", months: 12, name: "Bronze", accent: "#c47a3a" },
  { key: "copper", months: 24, name: "Copper", accent: "#d0643a" },
  { key: "silver", months: 36, name: "Silver", accent: "#8a93a8" },
  { key: "rosegold", months: 48, name: "Rose gold", accent: "#d4837a" },
  { key: "gold", months: 60, name: "Gold", accent: "#e2a91c" },
  { key: "platinum", months: 120, name: "Platinum", accent: "#7d8ba3" },
  { key: "diamond", months: 180, name: "Diamond", accent: "#1f8fd6" },
  { key: "legend", months: 240, name: "Legend", accent: "#b98a12" },
];

/**
 * Whole calendar months between the start date and `now` (the monthly
 * anniversary itself counts). Start dates are stored as UTC midnight, so the
 * calendar parts are read in UTC. Null without a start date; never negative.
 */
export function serviceMonths(hireDate: Date | null | undefined, now: Date = new Date()): number | null {
  if (!hireDate || Number.isNaN(hireDate.getTime())) return null;
  let months =
    (now.getUTCFullYear() - hireDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - hireDate.getUTCMonth());
  if (now.getUTCDate() < hireDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** The highest medal earned after this many months, or null before the first. */
export function serviceTier(months: number | null | undefined): ServiceTier | null {
  if (months == null) return null;
  let tier: ServiceTier | null = null;
  for (const t of SERVICE_TIERS) if (months >= t.months) tier = t;
  return tier;
}

/** The next medal still to earn, or null once someone is a Legend. */
export function nextServiceTier(months: number | null | undefined): ServiceTier | null {
  const m = months ?? 0;
  return SERVICE_TIERS.find((t) => t.months > m) ?? null;
}

/** The date someone reaches `months` months of service. */
export function anniversaryOf(hireDate: Date, months: number): Date {
  const d = new Date(hireDate);
  d.setUTCMonth(hireDate.getUTCMonth() + months);
  return d;
}

/** "6 months", "1 year", "7 years" (whole years from a year on). */
export function serviceLabel(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/** What a medal shows: the number and the unit under it ("6", "MONTHS"). */
export function medalFigure(months: number): { value: number; unit: string } {
  if (months < 12) return { value: months, unit: months === 1 ? "MONTH" : "MONTHS" };
  const years = Math.floor(months / 12);
  return { value: years, unit: years === 1 ? "YEAR" : "YEARS" };
}
