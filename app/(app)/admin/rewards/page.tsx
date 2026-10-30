import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getEconomyStatus, getMonthlyClaimCounts } from "@/lib/budget";
import { PageHeader } from "@/components/page-header";
import { BudgetCard } from "@/components/admin/budget-card";
import {
  RewardsManager,
  type RewardRow,
} from "@/components/admin/rewards-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  await requireAdmin();

  const settings = await getOrgSettings();
  const [rewards, sites, claims, status] = await Promise.all([
    prisma.reward.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        category: true,
        pointsCost: true,
        stock: true,
        euroCostCents: true,
        monthlyStock: true,
        siteId: true,
        active: true,
        fulfilment: true,
        type: true,
        sortOrder: true,
        kind: true,
        discountText: true,
        promoTag: true,
        promoText: true,
        promoEndsAt: true,
        wasPointsCost: true,
        fulfilmentAmount: true,
        fulfilmentUnit: true,
      },
    }),
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getMonthlyClaimCounts(),
    getEconomyStatus(settings),
  ]);

  const rows: RewardRow[] = rewards.map((r) => ({
    ...r,
    claimedThisMonth: claims.get(r.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Create and edit what staff can redeem, plus standing staff discounts. Labels such as Featured or Last chance put a reward in the Featured row of the shop. Set the conversion and budget in Economy. Claims stop for the month once the rewards budget is used, and per-month stock refills on the 1st. Hide an offering instead of deleting it."
      />
      <div className="mb-6">
        <BudgetCard status={status} />
      </div>
      <RewardsManager
        rows={rows}
        sites={sites}
        economy={{
          pointsPerEuro: settings.pointsPerEuro,
          monthlyRewardBudgetCents: settings.monthlyRewardBudgetCents,
        }}
      />
    </div>
  );
}
