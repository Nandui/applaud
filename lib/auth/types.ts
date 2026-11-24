import type { Role } from "@/lib/config";

/** The shape the app reads off the session everywhere. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Points rank (lib/ranks.ts): sets the monthly giving allowance. */
  pointsRank: string;
  /** Main site, shown next to their name. */
  siteId: string | null;
  /** Every site they work at, main site first (lib/sites.ts). */
  siteIds: string[];
  avatarUrl?: string | null;
  /** Finished the first-sign-in app tour (lib/onboarding.ts). */
  onboarded?: boolean;
  /** Has a date of birth saved (lib/birthday.ts). */
  hasBirthday?: boolean;
};

// Access hierarchy: staff < manager < admin. `operations` and `ceo` are
// specialist roles that carry NO elevated page/action access — they sit at the
// staff level here; their only extra power (applying boosts) is checked
// separately via canApplyBoost, not through this ranking.
const RANK: Record<Role, number> = {
  staff: 0,
  operations: 0,
  ceo: 0,
  manager: 1,
  admin: 2,
};

/** True if `role` meets or exceeds `min` in the staff < manager < admin order. */
export function roleAtLeast(role: string | undefined | null, min: Role): boolean {
  if (!role || !(role in RANK)) return false;
  return RANK[role as Role] >= RANK[min];
}

export function isAdmin(user?: { role: string } | null): boolean {
  return user?.role === "admin";
}

/** Managers and admins both pass the "manager" bar. */
export function isManager(user?: { role: string } | null): boolean {
  return roleAtLeast(user?.role, "manager");
}
