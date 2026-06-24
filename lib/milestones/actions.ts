"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { runMilestones } from "@/lib/milestones/run";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function updateMilestoneRule(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "");
  const points = Math.max(0, Math.floor(Number(formData.get("points"))));
  const active = String(formData.get("active") ?? "true") === "true";
  if (!id) return { ok: false, error: "Missing rule." };
  if (!Number.isFinite(points)) return { ok: false, error: "Invalid points." };

  let config: Record<string, unknown> = {};
  if (type === "work_anniversary") {
    const years = String(formData.get("years") ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (years.length === 0) {
      return { ok: false, error: "Add at least one anniversary year." };
    }
    config = { years };
  } else if (type === "onboarding") {
    config = {
      dayOffset: Math.max(0, Math.floor(Number(formData.get("dayOffset") ?? 30))),
    };
  }

  await prisma.milestoneRule.update({
    where: { id },
    data: { points, active, config: config as Prisma.InputJsonObject },
  });
  revalidatePath("/admin/milestones");
  return { ok: true, message: "Milestone rule saved." };
}

export async function setMilestoneRuleActive(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing rule." };
  await prisma.milestoneRule.update({ where: { id }, data: { active } });
  revalidatePath("/admin/milestones");
  return { ok: true };
}

/** Admin convenience: run the milestone job now (same logic as the cron). */
export async function runMilestonesNow(): Promise<ActionResult> {
  await requireAdmin();
  const result = await runMilestones();
  revalidatePath("/admin/milestones");
  revalidatePath("/");
  return {
    ok: true,
    message: `Done — ${result.created.length} created, ${result.skipped} already celebrated (${result.eligible} eligible).`,
  };
}
