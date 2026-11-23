import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseProfile, resolveLook } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import { COSMETIC_KINDS, RARITIES } from "@/lib/cosmetics";
import { serviceYears } from "@/lib/service";

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
          program: { select: { id: true, name: true, cadence: true, icon: true, color: true } },
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

  // What they've bought or claimed in the shop, for the profile's collection:
  // frames, then banners, then colours, rarest first within each.
  const owned = new Set(custom.owned);
  const collection = catalogue
    .filter((c) => owned.has(c.id))
    .sort(
      (a, b) =>
        COSMETIC_KINDS.indexOf(a.kind) - COSMETIC_KINDS.indexOf(b.kind) ||
        RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity),
    );

  return {
    user,
    custom,
    look: resolveLook(custom, catalogue),
    catalogue,
    collection,
    stats: {
      receivedCount,
      givenCount,
      pointsEarned,
    },
    valueTags,
    celebrations,
    /** Years of service from their start date (null when no start date is set). */
    service: user.hireDate
      ? { since: user.hireDate, years: serviceYears(user.hireDate) ?? 0, asOf: new Date() }
      : null,
    awards: awards.map((a) => ({
      id: a.id,
      programId: a.program.id,
      name: a.program.name,
      icon: a.program.icon,
      color: a.program.color,
      cadence: a.program.cadence,
      points: a.pointsAwarded,
      wonAt: a.reviewedAt ?? a.createdAt,
    })),
  };
});

export type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfileData>>>;
