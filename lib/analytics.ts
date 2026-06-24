import { format, eachDayOfInterval, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { periodRange, type Period } from "@/lib/periods";

export type Analytics = {
  participationRate: number; // 0-100
  participatingUsers: number;
  activeUsers: number;
  totalRecognitions: number;
  totalPoints: number;
  volume: { label: string; count: number }[];
  bySite: { label: string; count: number }[];
  valueUsage: { label: string; count: number; color: string }[];
  topReceivers: { id: string; name: string; points: number }[];
  topGivers: { id: string; name: string; count: number }[];
  medianTimeToFirstDays: number | null;
  newHireSample: number;
};

const PALETTE = ["#4f46e5", "#0e7c86", "#b45309", "#15803d", "#be123c", "#7c3aed", "#0ea5e9"];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function getAnalytics({
  siteId,
  period,
}: {
  siteId?: string;
  period: Period;
}): Promise<Analytics> {
  const range = periodRange(period);
  const createdAt = range ? { gte: range.gte, lte: range.lte } : undefined;
  const inSite = (s: string | null | undefined) => !siteId || s === siteId;

  const [activeUsers, sites, recognitions, hireRows] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, ...(siteId ? { siteId } : {}) },
      select: { id: true },
    }),
    prisma.site.findMany({ select: { id: true, name: true } }),
    prisma.recognition.findMany({
      where: { system: false, ...(createdAt ? { createdAt } : {}) },
      select: {
        id: true,
        createdAt: true,
        senderId: true,
        sender: { select: { siteId: true } },
        value: { select: { id: true, name: true, color: true } },
        recipients: {
          select: { userId: true, points: true, user: { select: { siteId: true } } },
        },
      },
    }),
    // New hires (last 18 months) + their received non-system recognitions, for
    // median time-to-first-recognition.
    prisma.recognitionRecipient.findMany({
      where: {
        recognition: { system: false },
        user: {
          active: true,
          hireDate: { gte: subMonths(new Date(), 18) },
          ...(siteId ? { siteId } : {}),
        },
      },
      select: {
        userId: true,
        user: { select: { hireDate: true } },
        recognition: { select: { createdAt: true } },
      },
    }),
  ]);

  const activeIds = new Set(activeUsers.map((u) => u.id));

  const givers = new Map<string, number>();
  const receiverPoints = new Map<string, number>();
  const participants = new Set<string>();
  const siteCounts = new Map<string, number>();
  const valueCounts = new Map<string, { name: string; color: string | null; count: number }>();
  const dayCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  let totalRecognitions = 0;
  let totalPoints = 0;

  for (const r of recognitions) {
    const senderInSite = inSite(r.sender.siteId);
    const recipientsInSite = r.recipients.filter((rr) => inSite(rr.user.siteId));
    const inScope = senderInSite || recipientsInSite.length > 0;
    if (!inScope) continue;

    totalRecognitions += 1;

    // Givers + participation (giver must be in site scope)
    if (senderInSite && activeIds.has(r.senderId)) {
      givers.set(r.senderId, (givers.get(r.senderId) ?? 0) + 1);
      participants.add(r.senderId);
    }
    // Receivers + participation (recipient in site scope)
    for (const rr of recipientsInSite) {
      totalPoints += rr.points;
      if (activeIds.has(rr.userId)) {
        receiverPoints.set(rr.userId, (receiverPoints.get(rr.userId) ?? 0) + rr.points);
        participants.add(rr.userId);
      }
    }

    // By sender site
    if (r.sender.siteId) {
      siteCounts.set(r.sender.siteId, (siteCounts.get(r.sender.siteId) ?? 0) + 1);
    }
    // Value usage
    if (r.value) {
      const v = valueCounts.get(r.value.id) ?? {
        name: r.value.name,
        color: r.value.color,
        count: 0,
      };
      v.count += 1;
      valueCounts.set(r.value.id, v);
    }
    // Volume buckets
    const dKey = format(r.createdAt, "yyyy-MM-dd");
    dayCounts.set(dKey, (dayCounts.get(dKey) ?? 0) + 1);
    const mKey = format(r.createdAt, "yyyy-MM");
    monthCounts.set(mKey, (monthCounts.get(mKey) ?? 0) + 1);
  }

  // Volume series
  let volume: { label: string; count: number }[];
  if (range) {
    const end = range.lte < new Date() ? range.lte : new Date();
    volume = eachDayOfInterval({ start: range.gte, end }).map((d) => ({
      label: format(d, "d MMM"),
      count: dayCounts.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  } else {
    volume = [...monthCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, count]) => ({ label: format(new Date(k + "-01"), "MMM yy"), count }));
  }

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const bySite = [...siteCounts.entries()]
    .map(([id, count]) => ({ label: siteName.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  const valueUsage = [...valueCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map((v, i) => ({ label: v.name, count: v.count, color: v.color ?? PALETTE[i % PALETTE.length] }));

  // Resolve names for top givers/receivers
  const topGiverIds = [...givers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topReceiverIds = [...receiverPoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const nameIds = [...new Set([...topGiverIds, ...topReceiverIds].map(([id]) => id))];
  const nameRows = nameIds.length
    ? await prisma.user.findMany({
        where: { id: { in: nameIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(nameRows.map((u) => [u.id, u.name]));

  // Median time-to-first-recognition
  const firstByUser = new Map<string, { hire: Date | null; first: Date }>();
  for (const row of hireRows) {
    const cur = firstByUser.get(row.userId);
    if (!cur || row.recognition.createdAt < cur.first) {
      firstByUser.set(row.userId, {
        hire: row.user.hireDate,
        first: row.recognition.createdAt,
      });
    }
  }
  const daysToFirst: number[] = [];
  for (const { hire, first } of firstByUser.values()) {
    if (!hire) continue;
    const days = Math.max(0, Math.round((first.getTime() - hire.getTime()) / 86_400_000));
    daysToFirst.push(days);
  }

  return {
    participationRate: activeIds.size
      ? Math.round((participants.size / activeIds.size) * 100)
      : 0,
    participatingUsers: participants.size,
    activeUsers: activeIds.size,
    totalRecognitions,
    totalPoints,
    volume,
    bySite,
    valueUsage,
    topReceivers: topReceiverIds.map(([id, points]) => ({
      id,
      name: nameMap.get(id) ?? "—",
      points,
    })),
    topGivers: topGiverIds.map(([id, count]) => ({
      id,
      name: nameMap.get(id) ?? "—",
      count,
    })),
    medianTimeToFirstDays: median(daysToFirst),
    newHireSample: daysToFirst.length,
  };
}
