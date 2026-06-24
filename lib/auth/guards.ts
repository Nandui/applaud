import { redirect } from "next/navigation";
import type { Role } from "@/lib/config";
import { getCurrentUser } from "./current-user";
import { roleAtLeast } from "./types";
import type { SessionUser } from "./types";

/**
 * Server-side guards. Use at the top of protected pages AND inside every
 * server action — the proxy is a convenience, not the security boundary.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!roleAtLeast(user.role, min)) redirect("/");
  return user;
}

export const requireManager = () => requireRole("manager");
export const requireAdmin = () => requireRole("admin");
