/**
 * Points ranks: how many points a person can give each month and the most
 * they can put on one recognition. A rank is separate from the app role
 * (which decides what someone can open and do), so an admin can be a Centre
 * manager and a CEO keeps their boost whatever their rank.
 *
 * Client-safe: no database imports.
 */

export const POINTS_RANKS = ["staff", "manager", "centre_manager", "operations", "ceo"] as const;
export type PointsRank = (typeof POINTS_RANKS)[number];

/** The OrgSettings column holding each rank's monthly giving allowance. */
export const RANK_ALLOWANCE_FIELD = {
  staff: "monthlyAllowanceStaff",
  manager: "monthlyAllowanceManager",
  centre_manager: "monthlyAllowanceCentreManager",
  operations: "monthlyAllowanceOperations",
  ceo: "monthlyAllowanceCeo",
} as const satisfies Record<PointsRank, string>;

export type AllowanceField = (typeof RANK_ALLOWANCE_FIELD)[PointsRank];
export type RankAllowances = Record<AllowanceField, number>;

export const RANK_LABELS: Record<PointsRank, string> = {
  staff: "Staff",
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

/** The monthly giving allowance for a rank. */
export function allowanceForRank(rank: string | null | undefined, settings: RankAllowances): number {
  return settings[RANK_ALLOWANCE_FIELD[normalise(rank)]];
}

/**
 * Most points per person on one recognition. Staff have their own limit;
 * every other rank shares the manager limit.
 */
export function maxPointsForRank(
  rank: string | null | undefined,
  settings: { maxPointsPerShoutoutStaff: number; maxPointsPerShoutoutManager: number },
): number {
  return normalise(rank) === "staff"
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
