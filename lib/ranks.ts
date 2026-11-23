/**
 * Points ranks: how many points a person can give each month and the most
 * they can put on one recognition. A rank is separate from the app role
 * (which decides what someone can open and do), so an admin can be a Centre
 * manager and a CEO keeps their boost whatever their rank.
 *
 * Client-safe: no database imports.
 */

export const POINTS_RANKS = ["staff", "backoffice", "manager", "centre_manager", "operations", "ceo"] as const;
export type PointsRank = (typeof POINTS_RANKS)[number];

/**
 * Ranks that never get points to give. Backoffice people use the app like
 * everyone else (recognitions without points, posts, comments, reactions) and
 * spend what they receive, but their monthly giving allowance is always 0.
 */
export const NO_ALLOWANCE_RANKS = ["backoffice"] as const satisfies readonly PointsRank[];
type NoAllowanceRank = (typeof NO_ALLOWANCE_RANKS)[number];
export type GivingRank = Exclude<PointsRank, NoAllowanceRank>;

/** Ranks with an editable allowance, in display order. */
export const GIVING_RANKS = POINTS_RANKS.filter(
  (r): r is GivingRank => !(NO_ALLOWANCE_RANKS as readonly string[]).includes(r),
);

/** The OrgSettings column holding each giving rank's monthly allowance. */
export const RANK_ALLOWANCE_FIELD = {
  staff: "monthlyAllowanceStaff",
  manager: "monthlyAllowanceManager",
  centre_manager: "monthlyAllowanceCentreManager",
  operations: "monthlyAllowanceOperations",
  ceo: "monthlyAllowanceCeo",
} as const satisfies Record<GivingRank, string>;

export type AllowanceField = (typeof RANK_ALLOWANCE_FIELD)[GivingRank];
export type RankAllowances = Record<AllowanceField, number>;

export const RANK_LABELS: Record<PointsRank, string> = {
  staff: "Staff",
  backoffice: "Backoffice",
  manager: "Manager",
  centre_manager: "Centre manager",
  operations: "Operations manager",
  ceo: "CEO",
};

export function isPointsRank(value: string): value is PointsRank {
  return (POINTS_RANKS as readonly string[]).includes(value);
}

/** Unknown values count as staff, the smallest allowance. */
function normalise(rank: string | null | undefined): PointsRank {
  return rank && isPointsRank(rank) ? rank : "staff";
}

/** Does this rank get any points to give each month? */
export function rankCanGivePoints(rank: string | null | undefined): boolean {
  return !(NO_ALLOWANCE_RANKS as readonly string[]).includes(normalise(rank));
}

/** The monthly giving allowance for a rank (always 0 for Backoffice). */
export function allowanceForRank(rank: string | null | undefined, settings: RankAllowances): number {
  const r = normalise(rank);
  if (r === "backoffice") return 0;
  return settings[RANK_ALLOWANCE_FIELD[r]];
}

/**
 * Most points per person on one recognition. Staff (and Backoffice, who have
 * nothing to give anyway) have their own limit; every other rank shares the
 * manager limit.
 */
export function maxPointsForRank(
  rank: string | null | undefined,
  settings: { maxPointsPerShoutoutStaff: number; maxPointsPerShoutoutManager: number },
): number {
  const r = normalise(rank);
  return r === "staff" || r === "backoffice"
    ? settings.maxPointsPerShoutoutStaff
    : settings.maxPointsPerShoutoutManager;
}

/**
 * The rank that matches an app role, used to suggest a rank when an admin
 * changes someone's role (and by the migration for existing people).
 */
export function rankForRole(role: string): PointsRank {
  if (role === "staff") return "staff";
  if (role === "operations") return "operations";
  if (role === "ceo") return "ceo";
  return "manager";
}

/**
 * Every rank above Staff gets the whole profile shop (frames, banners,
 * themes) at no cost: buying or "Buy all" takes nothing from their wallet.
 * Backoffice pays normal prices, like Staff. Rewards are not affected.
 */
export function shopIsFreeFor(rank: string | null | undefined): boolean {
  const r = normalise(rank);
  return r !== "staff" && r !== "backoffice";
}

/** What a profile shop price comes to for someone of this rank. */
export function shopPriceFor(rank: string | null | undefined, price: number): number {
  return shopIsFreeFor(rank) ? 0 : price;
}

