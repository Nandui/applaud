import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseProfile, resolveLook } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";

export const CELEBRATION_LABELS: Record<string, string> = {
  work_anniversary: "Work anniversary",
  birthday: "Birthday",
  onboarding: "Onboarding",
};

export const CELEBRATION_EMOJI: Record<string, string> = {
  work_anniversary: "🎊",
  birthday: "🎂",
  onboarding: "🚀",
};

/** Memoised per request: the page and its metadata both ask for it. */
export const getProfileData = cache(async (userId: string) => {
  const key = userId?.trim();
  if (!key || key === "undefined" || key === "null") return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: key }, { email: key.toLowerCase() }],
    },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      avatarUrl: true,
      role: true,
      hireDate: true,
      createdAt: true,
      active: true,
      profile: true,
      site: { select: { name: true, code: true } },
      managers: {
        orderBy: { manager: { name: "asc" } },
        select: { manager: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) return null;

  const id = user.id;

  const [receivedCount, givenCount, earn, valueRows, celebrations, awards, catalogue] =
    await Promise.all([
      prisma.recognitionRecipient.count({
        where: { userId: id, recognition: { system: false } },
      }),
      prisma.recognition.count({ where: { senderId: id, system: false, kind: "recognition" } }),
      prisma.rewardLedger.aggregate({
        _sum: { amount: true },
        where: { userId: id, type: { in: ["RECOGNITION", "AWARD"] } },
      }),
      prisma.recognitionRecipient.findMany({
        where: {
          userId: id,
          recognition: { system: false, valueId: { not: null } },
        },
        select: {
          recognition: {
            select: {
              value: {
                select: { id: true, name: true, icon: true, color: true, imageUrl: true },
              },
            },
          },
        },
      }),
      prisma.celebration.findMany({
        where: { userId: id },
        orderBy: { occurredOn: "desc" },
        take: 10,
      }),
      prisma.nomination.findMany({
        where: { nomineeId: id, status: "approved" },
        orderBy: { reviewedAt: "desc" },
        select: {
          id: true,
          reviewedAt: true,
          createdAt: true,
          pointsAwarded: true,
          program: { select: { name: true, cadence: true } },
        },
      }),
      getCatalogue(),
    ]);

  const tagMap = new Map<
    string,
    {
      value: { id: string; name: string; icon: string | null; color: string | null; imageUrl: string | null };
      count: number;
    }
  >();
  for (const r of valueRows) {
    const v = r.recognition.value;
    if (!v) continue;
    const t = tagMap.get(v.id) ?? { value: v, count: 0 };
    t.count += 1;
    tagMap.set(v.id, t);
  }
  const valueTags = [...tagMap.values()].sort((a, b) => b.count - a.count);

  const pointsEarned = earn._sum.amount ?? 0;
  const custom = parseProfile(user.profile);

  return {
    user,
    custom,
    look: resolveLook(custom, catalogue),
    catalogue,
    stats: {
      receivedCount,
      givenCount,
      pointsEarned,
    },
    valueTags,
    celebrations,
    awards: awards.map((a) => ({
      id: a.id,
      name: a.program.name,
      cadence: a.program.cadence,
      points: a.pointsAwarded,
      wonAt: a.reviewedAt ?? a.createdAt,
    })),
  };
});

export type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfileData>>>;
