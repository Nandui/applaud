"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ORG_SETTINGS_TAG } from "@/lib/org-settings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { parseEurosToCents } from "@/lib/economy";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function revalidateEconomy() {
  updateTag(ORG_SETTINGS_TAG);
  for (const path of ["/admin", "/admin/economy", "/admin/points", "/admin/rewards", "/rewards", "/shop", "/recognize", "/me"]) {
    revalidatePath(path);
  }
}

/** Save the economy: conversion rate, budget, allowances, limits and bonus pool. */
export async function updateEconomySettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const whole = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    const n = Number(raw);
    return raw !== "" && Number.isInteger(n) && n >= 0 ? n : null;
  };

  const pointsPerEuro = whole("pointsPerEuro");
  const monthlyRewardBudgetCents = parseEurosToCents(String(formData.get("monthlyRewardBudget") ?? ""));
  const monthlyAllowanceStaff = whole("monthlyAllowanceStaff");
  const monthlyAllowanceManager = whole("monthlyAllowanceManager");
  const maxPointsPerShoutoutStaff = whole("maxPointsPerShoutoutStaff");
  const maxPointsPerShoutoutManager = whole("maxPointsPerShoutoutManager");
  const monthlyBonusPool = whole("monthlyBonusPool");

  if (pointsPerEuro === null || pointsPerEuro < 1) {
    return { ok: false, error: "Points per euro must be a whole number of at least 1." };
  }
  if (monthlyRewardBudgetCents === null) {
    return { ok: false, error: "Enter the monthly rewards budget in euros, e.g. 500." };
  }
  if (
    monthlyAllowanceStaff === null ||
    monthlyAllowanceManager === null ||
    maxPointsPerShoutoutStaff === null ||
    maxPointsPerShoutoutManager === null ||
    monthlyBonusPool === null
  ) {
    return { ok: false, error: "Allowances, limits and the bonus pool must be whole numbers (0 or more)." };
  }

  const data = {
    pointsPerEuro,
    monthlyRewardBudgetCents,
    monthlyAllowanceStaff,
    monthlyAllowanceManager,
    maxPointsPerShoutoutStaff,
    maxPointsPerShoutoutManager,
    monthlyBonusPool,
  };
  await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  await writeAudit({
    actor: admin,
    action: "settings.updated",
    entityType: "org_settings",
    entityId: "singleton",
    summary: "Updated the points economy",
    metadata: data,
  });
  revalidateEconomy();
  return { ok: true, message: "Economy saved." };
}
