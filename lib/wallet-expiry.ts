import { prisma } from "@/lib/prisma";
import { lockPool } from "@/lib/locks";
import { recomputeWalletBalance } from "@/lib/points";
import {
  FIRST_WALLET_EXPIRY_YEAR,
  walletYear,
  yearEndExpiryAmount,
  zonedDayStart,
} from "@/lib/economy";

/** Ledger rows for a year end carry sourceType "year_end" and the year as sourceId. */
export const YEAR_END_SOURCE = "year_end";

export type YearEndResult = {
  year: number | null;
  status: "expired" | "already_done" | "not_due" | "switched_off";
  people: number;
  points: number;
};

/**
 * Expire every wallet's unspent points from the last finished year (Irish
 * time). Each person gets one EXPIRY ledger row, dated the last millisecond of
 * 31 Dec so it sits in that year's history, and their cached balance is
 * recomputed from the ledger.
 *
 * Safe to run any number of times: an advisory lock serialises runs, and
 * anyone who already has a row for that year is skipped. Points received
 * after midnight are never taken, and nobody goes below zero.
 *
 * Reward claims are untouched: their points left the wallet when they were
 * claimed, and a refund for a cancelled claim is a new ledger row on the day
 * it's cancelled, so it counts towards the year it lands in.
 */
export async function runYearEndExpiry(now: Date = new Date()): Promise<YearEndResult> {
  const year = walletYear(now).year - 1;
  if (year < FIRST_WALLET_EXPIRY_YEAR) return { year: null, status: "not_due", people: 0, points: 0 };

  // Read fresh rather than through the settings cache: this runs once a year.
  const settings = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
    select: { walletPointsExpireYearEnd: true },
  });
  if (settings && !settings.walletPointsExpireYearEnd) return { year, status: "switched_off", people: 0, points: 0 };

  const cutoff = zonedDayStart(year + 1, 0, 1);
  const datedAt = new Date(cutoff.getTime() - 1);
  const sourceId = String(year);

  return prisma.$transaction(
    async (tx) => {
      await lockPool(tx, "walletExpiry");

      const [done, atYearEnd, current] = await Promise.all([
        tx.rewardLedger.findMany({
          where: { type: "EXPIRY", sourceType: YEAR_END_SOURCE, sourceId },
          select: { userId: true },
        }),
        tx.rewardLedger.groupBy({
          by: ["userId"],
          _sum: { amount: true },
          where: { createdAt: { lt: cutoff } },
        }),
        tx.rewardLedger.groupBy({ by: ["userId"], _sum: { amount: true } }),
      ]);
      const already = new Set(done.map((d) => d.userId));
      const nowBalance = new Map(current.map((c) => [c.userId, c._sum.amount ?? 0]));

      const rows = atYearEnd
        .filter((r) => !already.has(r.userId))
        .map((r) => ({
          userId: r.userId,
          amount: yearEndExpiryAmount(r._sum.amount ?? 0, nowBalance.get(r.userId) ?? 0),
        }))
        .filter((r) => r.amount > 0);

      if (rows.length === 0) {
        return { year, status: already.size > 0 ? "already_done" : "expired", people: 0, points: 0 } as const;
      }

      await tx.rewardLedger.createMany({
        data: rows.map((r) => ({
          userId: r.userId,
          amount: -r.amount,
          type: "EXPIRY",
          sourceType: YEAR_END_SOURCE,
          sourceId,
          note: `Unspent points expired at the end of ${year}`,
          createdAt: datedAt,
        })),
      });
      for (const r of rows) {
        await recomputeWalletBalance(r.userId, tx);
      }
      return {
        year,
        status: "expired",
        people: rows.length,
        points: rows.reduce((s, r) => s + r.amount, 0),
      } as const;
    },
    { timeout: 60_000 },
  );
}

/** What expired at the end of `year`: points and how many people, for Admin. */
export async function getYearEndSummary(year: number): Promise<{ points: number; people: number }> {
  const agg = await prisma.rewardLedger.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
    where: { type: "EXPIRY", sourceType: YEAR_END_SOURCE, sourceId: String(year) },
  });
  return { points: Math.abs(agg._sum.amount ?? 0), people: agg._count._all };
}
