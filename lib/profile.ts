import { prisma } from "@/lib/prisma";

export const CELEBRATION_LABELS: Record<string, string> = {
  work_anniversary: "Work anniversary",
  birthday: "Birthday",
  onboarding: "Onboarding",
};

export async function getProfileData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      avatarUrl: true,
      role: true,
      hireDate: true,
      createdAt: true,
      active: true,
      site: { select: { name: true, code: true } },
      manager: { select: { id: true, name: true } },
    },
  });
  if (!user) return null;

  const [receivedCount, givenCount, earn, valueRows, celebrations] =
    await Promise.all([
      prisma.recognitionRecipient.count({
        where: { userId, recognition: { system: false } },
      }),
      prisma.recognition.count({ where: { senderId: userId, system: false } }),
      prisma.rewardLedger.aggregate({
        _sum: { amount: true },
        where: { userId, type: { in: ["RECOGNITION", "AWARD"] } },
      }),
      prisma.recognitionRecipient.findMany({
        where: {
          userId,
          recognition: { system: false, valueId: { not: null } },
        },
        select: {
          recognition: {
            select: {
              value: {
                select: { id: true, name: true, icon: true, color: true },
              },
            },
          },
        },
      }),
      prisma.celebration.findMany({
        where: { userId },
        orderBy: { occurredOn: "desc" },
        take: 10,
      }),
    ]);

  const tagMap = new Map<
    string,
    {
      value: { id: string; name: string; icon: string | null; color: string | null };
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

  return {
    user,
    stats: {
      receivedCount,
      givenCount,
      pointsEarned: earn._sum.amount ?? 0,
    },
    valueTags,
    celebrations,
  };
}
