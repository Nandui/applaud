import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { claimStatusLabel, expectedByLabel, isOverdue } from "@/lib/fulfilment";

export type ActiveClaim = {
  id: string;
  status: string;
  statusLabel: string;
  rewardName: string;
  imageUrl: string | null;
  /** "Expected Mon 9 Nov", "Running late", "Fulfilled", "Cancelled". */
  detail: string;
  overdue: boolean;
  /** An admin moved it on or left a note since they last opened My rewards. */
  updated: boolean;
};

/**
 * What to show outside My rewards: claims still on the way, plus any that
 * finished since they last looked (so "Fulfilled" news isn't missed). Open
 * claims with news first, then the rest by date.
 */
export const getActiveClaims = cache(
  async (userId: string): Promise<ActiveClaim[]> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { claimsSeenAt: true },
    });
    const seenAt = user?.claimsSeenAt ?? null;
    const rows = await prisma.redemption.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ["requested", "approved"] } },
          { statusChangedAt: seenAt ? { gt: seenAt } : { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        expectedBy: true,
        statusChangedAt: true,
        reward: {
          select: { name: true, imageUrl: true, fulfilmentUnit: true },
        },
      },
    });
    const now = new Date();
    const claims = rows.map((r): ActiveClaim => {
      const overdue = isOverdue(r, now);
      const detail =
        r.status === "fulfilled" || r.status === "cancelled"
          ? claimStatusLabel(r.status)
          : overdue
            ? "Running late"
            : r.expectedBy
              ? `Expected ${expectedByLabel(r.expectedBy, r.reward.fulfilmentUnit === "hours")}`
              : "We'll keep you posted";
      return {
        id: r.id,
        status: r.status,
        statusLabel: claimStatusLabel(r.status),
        rewardName: r.reward.name,
        imageUrl: r.reward.imageUrl,
        detail,
        overdue,
        updated:
          r.statusChangedAt !== null && (!seenAt || r.statusChangedAt > seenAt),
      };
    });
    return claims.sort((a, b) => Number(b.updated) - Number(a.updated));
  },
);
