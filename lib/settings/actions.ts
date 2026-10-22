"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ORG_SETTINGS_TAG } from "@/lib/org-settings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function updateOrgSettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const appName = String(formData.get("appName") ?? "").trim();
  const expiryRaw = String(formData.get("pointsExpiryMonths") ?? "").trim();
  const pointsExpiryMonths =
    expiryRaw === "" ? null : Math.max(1, Math.floor(Number(expiryRaw)));
  const allowSelfRecognition =
    String(formData.get("allowSelfRecognition") ?? "false") === "true";
  const autoCreateGoogleUsers =
    String(formData.get("autoCreateGoogleUsers") ?? "true") === "true";

  if (appName.length < 1) return { ok: false, error: "App name is required." };
  if (pointsExpiryMonths !== null && !Number.isFinite(pointsExpiryMonths)) {
    return { ok: false, error: "Expiry must be a number of months or blank." };
  }

  const data = {
    appName,
    pointsExpiryMonths,
    allowSelfRecognition,
    autoCreateGoogleUsers,
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
    summary: "Updated organisation settings",
    metadata: data,
  });
  updateTag(ORG_SETTINGS_TAG);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved." };
}
