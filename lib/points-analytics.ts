import { prisma } from "@/lib/prisma";
import { allowanceForRole } from "@/lib/points";
import { ECONOMY_TIMEZONE, economyMonth } from "@/lib/economy";
import type { OrgSettings } from "@/lib/org-settings";

/** "2026-10" for the economy month containing `ref`. */
export function monthKey(ref: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECONOMY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ref);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

/** Mid-month instant for a "YYYY-MM" key (safely inside the month in any zone). */
export function monthRef(key: string | undefined): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!m) return new Date();
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) return new Date();
  return new Date(Date.UTC(Number(m[1]), month0, 15, 12));
}

export function shiftMonth(key: string, by: number): string {
  const ref = monthRef(key);
  return monthKey(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + by, 15, 12)));
}

/**
 * Everything about points in one economy month: what could be given, what
 * was given and is left, what landed in wallets, what was spent in the Store
 * and on rewards, the bonus pool, and the cash claimed against the budget.
 */
export async function getPointsMonth(settings: OrgSettings, ref: Date) {
  const month = economyMonth(ref);
  const rate = settings.pointsPerEuro;

  const [people, sent, instantAwards, ledger, redemptions, rewards] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, siteId: { not: null } },
      select: { id: true, name: true, role: true, jobTitle: true, walletBalance: true },
      orderBy: { name: "asc" },
    }),
    prisma.recognition.findMany({
      where: { createdAt: month, system: false, kind: "recognition" },
      select: { senderId: true, createdAt: true, recipients: { select: { points: true } } },
    }),
    prisma.nomination.findMany({
      where: { status: "approved", program: { requiresApproval: false }, createdAt: month },
      select: { nominatorId: true, pointsAwarded: true, createdAt: true },
    }),
    prisma.rewardLedger.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { createdAt: month },
    }),
    prisma.redemption.groupBy({
      by: ["rewardId"],
      _count: { _all: true },
      _sum: { pointsCost: true, euroCostCents: true },
      where: { createdAt: month, status: { not: "cancelled" } },
    }),
    prisma.reward.findMany({ select: { id: true, name: true, monthlyStock: true } }),
  ]);

  // Points given per sender, and per Irish calendar day for the chart.
  const givenBy = new Map<string, number>();
  const dayFormat = new Intl.DateTimeFormat("en-IE", { timeZone: ECONOMY_TIMEZONE, day: "numeric" });
  const byDay = new Map<number, number>();
  const add = (senderId: string, points: number, at: Date) => {
    if (points <= 0) return;
    givenBy.set(senderId, (givenBy.get(senderId) ?? 0) + points);
    const day = Number(dayFormat.format(at));
    byDay.set(day, (byDay.get(day) ?? 0) + points);
  };
  for (const r of sent) add(r.senderId, r.recipients.reduce((s, x) => s + Math.max(0, x.points), 0), r.createdAt);
  for (const n of instantAwards) add(n.nominatorId, n.pointsAwarded, n.createdAt);

  const rows = people
    .map((p) => {
      const allowance = allowanceForRole(p.role, settings);
      const given = givenBy.get(p.id) ?? 0;
      return { ...p, allowance, given, left: Math.max(0, allowance - given) };
    })
    .sort((a, b) => b.given - a.given || a.name.localeCompare(b.name));

  const totalAllowance = rows.reduce((s, r) => s + r.allowance, 0);
  const given = rows.reduce((s, r) => s + r.given, 0);
  const left = rows.reduce((s, r) => s + r.left, 0);
  const givers = rows.filter((r) => r.given > 0).length;

  const sumType = (t: string) => ledger.find((l) => l.type === t)?._sum.amount ?? 0;
  const instantTotal = instantAwards.reduce((s, n) => s + n.pointsAwarded, 0);
  const received = sumType("RECOGNITION") + sumType("AWARD") + Math.max(0, sumType("BOOST"));
  const bonusUsed = Math.max(0, sumType("AWARD") + sumType("BOOST") - instantTotal);
  const spentStore = Math.abs(sumType("SHOP"));
  const spentRewards = redemptions.reduce((s, r) => s + (r._sum.pointsCost ?? 0), 0);
  const cashCents = redemptions.reduce((s, r) => s + (r._sum.euroCostCents ?? 0), 0);

  const rewardName = new Map(rewards.map((r) => [r.id, r]));
  const claims = redemptions
    .map((r) => ({
      name: rewardName.get(r.rewardId)?.name ?? "Removed reward",
      monthlyStock: rewardName.get(r.rewardId)?.monthlyStock ?? null,
      count: r._count._all,
      points: r._sum.pointsCost ?? 0,
      cents: r._sum.euroCostCents ?? 0,
    }))
    .sort((a, b) => b.cents - a.cents || b.count - a.count);

  // Days in this month (Irish time) for a gap-free chart.
  const days = Math.round((month.lt.getTime() - month.gte.getTime()) / 86_400_000);
  const daily = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), count: byDay.get(i + 1) ?? 0 }));

  return {
    month,
    rate,
    people: rows,
    totalAllowance,
    given,
    left,
    givers,
    received,
    bonusUsed,
    bonusPool: settings.monthlyBonusPool,
    spentStore,
    spentRewards,
    cashCents,
    budgetCents: settings.monthlyRewardBudgetCents,
    claims,
    daily,
    walletPoints: rows.reduce((s, r) => s + r.walletBalance, 0),
  };
}
