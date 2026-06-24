import { prisma } from "@/lib/prisma";
import { periodRange, type Period } from "@/lib/periods";

export { PERIODS, PERIOD_LABELS, type Period } from "@/lib/periods";

type LeaderUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  siteCode: string;
};

export type ReceiverRow = LeaderUser & { points: number; count: number };
export type GiverRow = LeaderUser & { count: number; pointsGiven: number };

export type Leaderboard = {
  receivers: ReceiverRow[];
  givers: GiverRow[];
};

/**
 * Top receivers (points earned, from the ledger so it reconciles) and top
 * givers (recognitions sent), filterable by site and period.
 */
export async function getLeaderboard({
  siteId,
  period,
  take = 10,
}: {
  siteId?: string;
  period: Period;
  take?: number;
}): Promise<Leaderboard> {
  const range = periodRange(period);
  const createdAt = range ? { gte: range.gte, lte: range.lte } : undefined;
  const userFilter = siteId ? { siteId } : undefined;

  const [ledgerRows, recipientRows, sentRows] = await Promise.all([
    // Points received = earn rows in the ledger (reconciles with the wallet).
    prisma.rewardLedger.findMany({
      where: {
        type: { in: ["RECOGNITION", "AWARD"] },
        ...(createdAt ? { createdAt } : {}),
        ...(userFilter ? { user: userFilter } : {}),
      },
      select: { userId: true, amount: true },
    }),
    // Peer recognitions received (non-system) for the count metric.
    prisma.recognitionRecipient.findMany({
      where: {
        recognition: { system: false, ...(createdAt ? { createdAt } : {}) },
        ...(userFilter ? { user: userFilter } : {}),
      },
      select: { userId: true },
    }),
    // Recognitions given (non-system).
    prisma.recognition.findMany({
      where: {
        system: false,
        ...(createdAt ? { createdAt } : {}),
        ...(userFilter ? { sender: userFilter } : {}),
      },
      select: { senderId: true, recipients: { select: { points: true } } },
    }),
  ]);

  const pointsByUser = new Map<string, number>();
  for (const r of ledgerRows) {
    pointsByUser.set(r.userId, (pointsByUser.get(r.userId) ?? 0) + r.amount);
  }
  const countByReceiver = new Map<string, number>();
  for (const r of recipientRows) {
    countByReceiver.set(r.userId, (countByReceiver.get(r.userId) ?? 0) + 1);
  }
  const giverStats = new Map<string, { count: number; pointsGiven: number }>();
  for (const r of sentRows) {
    const g = giverStats.get(r.senderId) ?? { count: 0, pointsGiven: 0 };
    g.count += 1;
    g.pointsGiven += r.recipients.reduce((sum, x) => sum + x.points, 0);
    giverStats.set(r.senderId, g);
  }

  const involved = new Set<string>([
    ...pointsByUser.keys(),
    ...countByReceiver.keys(),
    ...giverStats.keys(),
  ]);
  const users = await prisma.user.findMany({
    where: { id: { in: [...involved] } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      jobTitle: true,
      site: { select: { code: true } },
    },
  });
  const userMap = new Map<string, LeaderUser>(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        jobTitle: u.jobTitle,
        siteCode: u.site.code,
      },
    ]),
  );

  const receivers: ReceiverRow[] = [...involved]
    .filter((id) => (pointsByUser.get(id) ?? 0) > 0 || (countByReceiver.get(id) ?? 0) > 0)
    .map((id) => ({
      ...userMap.get(id)!,
      points: pointsByUser.get(id) ?? 0,
      count: countByReceiver.get(id) ?? 0,
    }))
    .filter((r) => r.id)
    .sort((a, b) => b.points - a.points || b.count - a.count)
    .slice(0, take);

  const givers: GiverRow[] = [...giverStats.entries()]
    .map(([id, g]) => ({ ...userMap.get(id)!, count: g.count, pointsGiven: g.pointsGiven }))
    .filter((r) => r.id)
    .sort((a, b) => b.count - a.count || b.pointsGiven - a.pointsGiven)
    .slice(0, take);

  return { receivers, givers };
}
