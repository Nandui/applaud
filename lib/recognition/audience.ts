import { prisma } from "@/lib/prisma";
import { siteIdsOf, userSitesSelect } from "@/lib/sites";

/**
 * When a recognition went to a whole group, a name for it: "everyone" when it
 * covers every active person (the sender aside), or "everyone at Mahon" when it
 * covers everyone who works at one site. Null for a hand-picked group, or for
 * fewer than 5 people, where the names read better.
 */
export async function audienceLabel(recipientIds: string[], senderId: string): Promise<string | null> {
  // The sender counts as neither in nor out (they may recognise themselves).
  const picked = new Set(recipientIds.filter((id) => id !== senderId));
  if (picked.size < 5) return null;
  const people = await prisma.user.findMany({
    where: { active: true, id: { not: senderId } },
    select: { id: true, ...userSitesSelect },
  });
  if (people.every((p) => picked.has(p.id))) return "everyone";

  const bySite = new Map<string, string[]>();
  for (const p of people) {
    for (const siteId of siteIdsOf(p)) bySite.set(siteId, [...(bySite.get(siteId) ?? []), p.id]);
  }
  for (const [siteId, ids] of bySite) {
    if (ids.length !== picked.size || !ids.every((id) => picked.has(id))) continue;
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
    if (site) return `everyone at ${site.name}`;
  }
  return null;
}
