import type { Role } from "@/lib/config";

/** The shape the app reads off the session everywhere. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  siteId: string;
  avatarUrl?: string | null;
};

const RANK: Record<Role, number> = { staff: 0, manager: 1, admin: 2 };

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
