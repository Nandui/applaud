import { prisma } from "@/lib/prisma";
import { economyMonth, pointsToCents, resetDateLabel } from "@/lib/economy";
import { getMonthlyBonusUsage } from "@/lib/points";

const LIVE = { status: { not: "cancelled" } } as const;

/**
 * Where this month's money stands: cash claimed against the rewards budget,
 * bonus-pool points used, and the points sitting in wallets (a liability,
 * since they can be claimed in any future month).
 */
export async function getEconomyStatus(settings: {
  pointsPerEuro: number;
  monthlyRewardBudgetCents: number;
  monthlyBonusPool: number;
}) {
  const month = economyMonth();
  const [spent, claims, wallets, bonusUsed] = await Promise.all([
    prisma.redemption.aggregate({
      _sum: { euroCostCents: true },
      where: { ...LIVE, createdAt: month },
    }),
    prisma.redemption.count({ where: { ...LIVE, createdAt: month } }),
    prisma.user.aggregate({ _sum: { walletBalance: true }, where: { active: true } }),
    getMonthlyBonusUsage(),
  ]);
  const spentCents = spent._sum.euroCostCents ?? 0;
  return {
    budgetCents: settings.monthlyRewardBudgetCents,
    spentCents,
    leftCents: Math.max(0, settings.monthlyRewardBudgetCents - spentCents),
    claims,
    walletPoints: wallets._sum.walletBalance ?? 0,
    walletCents: pointsToCents(wallets._sum.walletBalance ?? 0, settings.pointsPerEuro),
    bonusPool: settings.monthlyBonusPool,
    bonusUsed,
    resetsOn: resetDateLabel(),
  };
}

export type EconomyStatus = Awaited<ReturnType<typeof getEconomyStatus>>;

/** Live claims this month per reward id. */
export async function getMonthlyClaimCounts(): Promise<Map<string, number>> {
  const rows = await prisma.redemption.groupBy({
    by: ["rewardId"],
    _count: { _all: true },
    where: { ...LIVE, createdAt: economyMonth() },
  });
  return new Map(rows.map((r) => [r.rewardId, r._count._all]));
}
