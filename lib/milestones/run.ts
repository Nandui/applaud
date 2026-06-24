import { prisma } from "@/lib/prisma";

type RunResult = {
  date: string;
  created: { type: string; userName: string; points: number }[];
  skipped: number;
  eligible: number;
};

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function sameMonthDay(a: Date, ref: Date): boolean {
  return a.getUTCMonth() === ref.getUTCMonth() && a.getUTCDate() === ref.getUTCDate();
}

function milestoneMessage(type: string, name: string, years: number): string {
  if (type === "work_anniversary") {
    return `🎉 Happy ${years}-year work anniversary, ${name}! Thanks for all you do.`;
  }
  if (type === "birthday") return `🎂 Happy birthday, ${name}! 🥳`;
  if (type === "onboarding") {
    return `👋 ${name} is settling in — welcome to the team!`;
  }
  return `🎉 Congratulations, ${name}!`;
}

/**
 * Find users hitting a milestone on `referenceDate` per each active rule, and
 * for each create a Celebration (idempotent via the [userId, type, occurredOn]
 * unique constraint), a system feed post, and an AWARD ledger row if the rule
 * grants points. Safe to run multiple times a day — re-runs are no-ops.
 */
export async function runMilestones(referenceDate: Date = new Date()): Promise<RunResult> {
  const occurredOn = utcMidnight(referenceDate);
  const result: RunResult = {
    date: occurredOn.toISOString().slice(0, 10),
    created: [],
    skipped: 0,
    eligible: 0,
  };

  const [rules, users, systemUser] = await Promise.all([
    prisma.milestoneRule.findMany({ where: { active: true } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, hireDate: true, birthday: true },
    }),
    prisma.user.findFirst({ where: { role: "admin", active: true }, select: { id: true } }),
  ]);

  const senderId = systemUser?.id;
  if (!senderId) return result; // no admin to post as; nothing to do

  type Eligible = { userId: string; userName: string; type: string; years: number };
  const eligible: Eligible[] = [];

  for (const rule of rules) {
    const config = (rule.config ?? {}) as Record<string, unknown>;
    for (const u of users) {
      if (rule.type === "work_anniversary" && u.hireDate) {
        const years =
          referenceDate.getUTCFullYear() - u.hireDate.getUTCFullYear();
        const allowed = Array.isArray(config.years)
          ? (config.years as number[])
          : [];
        if (years > 0 && sameMonthDay(u.hireDate, referenceDate) && allowed.includes(years)) {
          eligible.push({ userId: u.id, userName: u.name, type: rule.type, years });
        }
      } else if (rule.type === "birthday" && u.birthday) {
        if (sameMonthDay(u.birthday, referenceDate)) {
          eligible.push({ userId: u.id, userName: u.name, type: rule.type, years: 0 });
        }
      } else if (rule.type === "onboarding" && u.hireDate) {
        const dayOffset = Number(config.dayOffset ?? 0);
        const onboardingDate = new Date(
          u.hireDate.getTime() + dayOffset * 86_400_000,
        );
        if (utcMidnight(onboardingDate).getTime() === occurredOn.getTime()) {
          eligible.push({ userId: u.id, userName: u.name, type: rule.type, years: 0 });
        }
      }
    }
  }

  result.eligible = eligible.length;
  const pointsByType = new Map(rules.map((r) => [r.type, r.points]));

  for (const e of eligible) {
    const points = pointsByType.get(e.type) ?? 0;

    // Pre-check the idempotency guard to avoid throwing on normal re-runs.
    const existing = await prisma.celebration.findUnique({
      where: {
        userId_type_occurredOn: { userId: e.userId, type: e.type, occurredOn },
      },
      select: { id: true },
    });
    if (existing) {
      result.skipped += 1;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const celebration = await tx.celebration.create({
          data: { userId: e.userId, type: e.type, occurredOn },
        });
        const post = await tx.recognition.create({
          data: {
            senderId,
            system: true,
            message: milestoneMessage(e.type, e.userName, e.years),
            recipients: { create: [{ userId: e.userId, points: 0 }] },
          },
        });
        await tx.celebration.update({
          where: { id: celebration.id },
          data: { recognitionId: post.id },
        });
        if (points > 0) {
          await tx.rewardLedger.create({
            data: {
              userId: e.userId,
              amount: points,
              type: "AWARD",
              sourceType: "milestone",
              sourceId: celebration.id,
              note: `Milestone: ${e.type.replace(/_/g, " ")}`,
            },
          });
          await tx.user.update({
            where: { id: e.userId },
            data: { walletBalance: { increment: points } },
          });
        }
      });
      result.created.push({ type: e.type, userName: e.userName, points });
    } catch (error) {
      // Unique violation = another run already created it; treat as skipped.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return result;
}
