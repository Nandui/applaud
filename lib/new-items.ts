import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCatalogue } from "@/lib/catalogue";
import { ownsItem, parseProfile } from "@/lib/profile-custom";
import { isNewSince, type NewCounts } from "@/lib/seen";
import type { SessionUser } from "@/lib/auth/types";

/** Rewards this person can see: shown, and for every site or theirs. */
export function visibleRewardsWhere(user: Pick<SessionUser, "siteId">) {
  return { active: true, OR: [{ siteId: null }, { siteId: user.siteId }] };
}

/**
 * How many Store items and rewards were listed since this person last opened
 * each page, for the dots on the Store tabs. Items they already own don't count.
 */
export const getNewCounts = cache(async (user: SessionUser): Promise<NewCounts> => {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { shopSeenAt: true, rewardsSeenAt: true, profile: true },
  });
  if (!row) return { shop: 0, rewards: 0 };
  const [catalogue, rewards] = await Promise.all([
    getCatalogue(),
    prisma.reward.count({
      where: {
        ...visibleRewardsWhere(user),
        ...(row.rewardsSeenAt ? { listedAt: { gt: row.rewardsSeenAt } } : {}),
      },
    }),
  ]);
  const custom = parseProfile(row.profile);
  const shop = catalogue.filter((c) => c.active && !ownsItem(custom, c) && isNewSince(c.listedAt, row.shopSeenAt)).length;
  return { shop, rewards };
});
