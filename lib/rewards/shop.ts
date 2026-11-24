import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getEconomyStatus, getMonthlyClaimCounts } from "@/lib/budget";
import { checkClaim } from "@/lib/economy";
import { visibleRewardsWhere } from "@/lib/new-items";
import { isNewSince } from "@/lib/seen";
import { endsLabel, promoState } from "@/lib/reward-promo";
import { fulfilmentLabel } from "@/lib/fulfilment";
import { shopLayout } from "@/lib/rewards/layout";

/**
 * Everything the staff Rewards page shows, for one viewer at one moment. The
 * page itself and the admin's phone preview (Admin > Rewards) both use it, so
 * the preview is the real page, not a lookalike.
 */
export async function loadRewardsShop({
  siteIds,
  seenAt,
  now,
}: {
  /** The viewer's sites; empty sees only offerings for all sites. */
  siteIds: string[];
  /** When they last opened Rewards, for New tags (null = never). */
  seenAt: Date | null;
  now: Date;
}) {
  const settings = await getOrgSettings();
  const [catalogue, claims, economy] = await Promise.all([
    prisma.reward.findMany({
      where: visibleRewardsWhere({ siteIds }, now),
      orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        imageUrl: true,
        pointsCost: true,
        stock: true,
        euroCostCents: true,
        monthlyStock: true,
        listedAt: true,
        kind: true,
        discountText: true,
        promoTag: true,
        promoText: true,
        promoEndsAt: true,
        wasPointsCost: true,
        fulfilmentAmount: true,
        fulfilmentUnit: true,
        sortOrder: true,
        featuredOrder: true,
      },
    }),
    getMonthlyClaimCounts(),
    getEconomyStatus(settings),
  ]);

  // Monthly stock and the company budget decide what can be claimed right now.
  // Staff never see euros: a reward over budget just shows "All claimed".
  const layout = shopLayout(catalogue, now);
  const toCard = (raw: (typeof catalogue)[number]) => {
    const {
      euroCostCents,
      monthlyStock,
      listedAt,
      promoTag,
      promoText,
      promoEndsAt,
      wasPointsCost,
      fulfilmentAmount,
      fulfilmentUnit,
      ...r
    } = raw;
    const promo = promoState({ ...r, promoTag, promoText, promoEndsAt, wasPointsCost }, now);
    const claimedThisMonth = claims.get(r.id) ?? 0;
    const check = checkClaim({
      euroCostCents,
      monthlyStock,
      claimedThisMonth,
      spentCents: economy.spentCents,
      budgetCents: economy.budgetCents,
    });
    return {
      ...r,
      pointsCost: promo.pointsCost,
      wasPointsCost: promo.wasPointsCost,
      promo: promo.tag
        ? { tag: promo.tag, label: promo.label!, ends: promo.endsAt ? endsLabel(promo.endsAt, now) : null }
        : null,
      monthLeft: monthlyStock === null ? null : Math.max(0, monthlyStock - claimedThisMonth),
      backOn: check.ok ? null : economy.resetsOn,
      isNew: isNewSince(listedAt, seenAt),
      wait: fulfilmentLabel(fulfilmentAmount, fulfilmentUnit),
    };
  };

  return {
    settings,
    discounts: layout.discounts.map(toCard),
    featured: layout.featured.map(toCard),
    categories: layout.categories.map((c) => ({ name: c.name, items: c.items.map(toCard) })),
  };
}

export type RewardsShopData = Awaited<ReturnType<typeof loadRewardsShop>>;
