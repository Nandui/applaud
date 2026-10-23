"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { seenAtFor, type SeenArea } from "@/lib/seen";

/**
 * Remember that the signed-in person has looked at the profile shop or the
 * rewards list as it was at `renderedAt` (ms), so those items stop being "New".
 * Only ever moves the time forward, so an old tab can't bring "New" back.
 */
export async function markSeen(area: SeenArea, renderedAt: number): Promise<void> {
  const me = await requireUser();
  const at = seenAtFor(renderedAt);
  if (!at) return;
  if (area === "shop") {
    await prisma.user.updateMany({
      where: { id: me.id, OR: [{ shopSeenAt: null }, { shopSeenAt: { lt: at } }] },
      data: { shopSeenAt: at },
    });
  } else if (area === "rewards") {
    await prisma.user.updateMany({
      where: { id: me.id, OR: [{ rewardsSeenAt: null }, { rewardsSeenAt: { lt: at } }] },
      data: { rewardsSeenAt: at },
    });
  }
}
