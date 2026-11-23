/**
 * Years of service: each person's start date (User.hireDate, set in
 * Admin > Users) earns them a service medal at 1, 3, 5, 10, 15 and 20 years,
 * each in a rarer metal. Shown big on their profile and small next to their
 * name in the feed (components/service-medal.tsx).
 */

export type ServiceTierKey = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";

export type ServiceTier = {
  key: ServiceTierKey;
  /** Whole years of service this medal is earned at. */
  years: number;
  /** The metal, as people see it ("Gold"). */
  name: string;
  /** Its signature colour, for the plaque and labels around the medal. */
  accent: string;
};

export const SERVICE_TIERS: readonly ServiceTier[] = [
  { key: "bronze", years: 1, name: "Bronze", accent: "#c47a3a" },
  { key: "silver", years: 3, name: "Silver", accent: "#8a93a8" },
  { key: "gold", years: 5, name: "Gold", accent: "#e2a91c" },
  { key: "platinum", years: 10, name: "Platinum", accent: "#7d8ba3" },
  { key: "diamond", years: 15, name: "Diamond", accent: "#1f8fd6" },
  { key: "legend", years: 20, name: "Legend", accent: "#b98a12" },
];

/**
 * Whole years between the start date and `now`, by calendar date (the
 * anniversary itself counts). Start dates are stored as UTC midnight, so the
 * calendar parts are read in UTC. Null without a start date; never negative.
 */
export function serviceYears(hireDate: Date | null | undefined, now: Date = new Date()): number | null {
  if (!hireDate || Number.isNaN(hireDate.getTime())) return null;
  let years = now.getUTCFullYear() - hireDate.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < hireDate.getUTCMonth() ||
    (now.getUTCMonth() === hireDate.getUTCMonth() && now.getUTCDate() < hireDate.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

/** The highest medal earned after this many years, or null before the first. */
export function serviceTier(years: number | null | undefined): ServiceTier | null {
  if (years == null) return null;
  let tier: ServiceTier | null = null;
  for (const t of SERVICE_TIERS) if (years >= t.years) tier = t;
  return tier;
}

/** The next medal still to earn, or null once someone is a Legend. */
export function nextServiceTier(years: number | null | undefined): ServiceTier | null {
  const y = years ?? 0;
  return SERVICE_TIERS.find((t) => t.years > y) ?? null;
}

/** The date someone reaches `years` years of service. */
export function anniversaryOf(hireDate: Date, years: number): Date {
  const d = new Date(hireDate);
  d.setUTCFullYear(hireDate.getUTCFullYear() + years);
  return d;
}

/** "1 year", "7 years". */
export function yearsLabel(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}
