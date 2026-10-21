import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/config";
import type { SessionUser } from "./types";

/** Returns the signed-in user, or null when signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u) return null;

  const email = u.email?.trim().toLowerCase() || undefined;
  const id =
    u.id && u.id !== "undefined" && u.id !== "null" ? u.id : undefined;
  if (!id && !email) return null;

  const dbUser = await prisma.user.findFirst({
    where: {
      active: true,
      OR: [...(id ? [{ id }] : []), ...(email ? [{ email }] : [])],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      siteId: true,
      avatarUrl: true,
    },
  });
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: (dbUser.role ?? "staff") as Role,
    siteId: dbUser.siteId,
    avatarUrl: dbUser.avatarUrl,
  };
}
