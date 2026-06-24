import { auth } from "@/auth";
import type { Role } from "@/lib/config";
import type { SessionUser } from "./types";

/** Returns the signed-in user, or null when signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    role: (u.role ?? "staff") as Role,
    siteId: u.siteId,
    avatarUrl: u.image ?? null,
  };
}
