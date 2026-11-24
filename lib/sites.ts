import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * A person has one main site (User.siteId, shown next to their name) and may
 * also work at further sites (UserSite). Anything limited to a site counts
 * every one of them.
 */

/** Select this on a user to read every site they work at with siteIdsOf. */
export const userSitesSelect = {
  siteId: true,
  otherSites: { select: { siteId: true } },
} as const;

/** Main site first, then the others; empty for a removed person. */
export function siteIdsOf(u: {
  siteId: string | null;
  otherSites?: { siteId: string }[] | null;
}): string[] {
  if (!u.siteId) return [];
  const extra = (u.otherSites ?? []).map((s) => s.siteId).filter((id) => id !== u.siteId);
  return [u.siteId, ...new Set(extra)];
}

/** Users who work at this site, as their main site or one of the others. */
export function worksAtSite(siteId: string): Prisma.UserWhereInput {
  return { OR: [{ siteId }, { otherSites: { some: { siteId } } }] };
}
