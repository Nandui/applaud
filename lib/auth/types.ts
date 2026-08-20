import type { Role } from "@/lib/config";

/** The shape the app reads off the session everywhere. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  siteId: string | null;
  avatarUrl?: string | null;
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
