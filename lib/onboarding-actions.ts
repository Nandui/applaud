"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { WELCOME_POINTS } from "@/lib/onboarding";

export type FinishTourResult = { ok: true; awarded: number; balance: number };

/**
 * The signed-in person finished the app tour. The first time, mark them as
 * onboarded and pay the welcome points; any later call (a replay from the
 * menu, a double tap, a second tab) pays nothing. The conditional update is
 * the guard: only the one call that flips onboardedAt from null pays, because
 * Postgres re-checks the WHERE after a concurrent update commits.
 */
export async function finishTour(): Promise<FinishTourResult> {
  const me = await requireUser();

  const awarded = await prisma.$transaction(async (tx) => {
    const flipped = await tx.user.updateMany({
      where: { id: me.id, onboardedAt: null },
      data: { onboardedAt: new Date() },
    });
    if (flipped.count !== 1 || WELCOME_POINTS <= 0) return 0;
    await tx.rewardLedger.create({
      data: {
        userId: me.id,
        amount: WELCOME_POINTS,
        type: "WELCOME",
        sourceType: "onboarding",
        sourceId: me.id,
        note: "Welcome to the app",
      },
    });
    await tx.user.update({
      where: { id: me.id },
      data: { walletBalance: { increment: WELCOME_POINTS } },
    });
    return WELCOME_POINTS;
  });

  const row = await prisma.user.findUnique({
    where: { id: me.id },
    select: { walletBalance: true },
  });

  if (awarded > 0) {
    await writeAudit({
      actor: me,
      action: "user.onboarded",
      entityType: "user",
      entityId: me.id,
      summary: `Finished the app tour and got ${awarded} welcome points`,
      siteId: me.siteId,
    });
    revalidatePath("/", "layout");
  }

  return { ok: true, awarded, balance: row?.walletBalance ?? 0 };
}
