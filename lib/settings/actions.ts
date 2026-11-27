"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ORG_SETTINGS_TAG } from "@/lib/org-settings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const CHAT_SWITCHES = [
  "chatRecognitions",
  "chatCovers",
  "chatAwards",
  "chatMilestones",
  "chatRewardClaims",
] as const;

const EMAIL_SWITCHES = [
  "emailsEnabled",
  "emailRecognitions",
  "emailTeamAnnouncements",
  "emailInvites",
] as const;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function updateOrgSettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const appName = String(formData.get("appName") ?? "").trim();
  const allowSelfRecognition =
    String(formData.get("allowSelfRecognition") ?? "false") === "true";
  const autoCreateGoogleUsers =
    String(formData.get("autoCreateGoogleUsers") ?? "true") === "true";

  const chat = Object.fromEntries(
    CHAT_SWITCHES.map((key) => [key, String(formData.get(key) ?? "false") === "true"]),
  ) as Record<(typeof CHAT_SWITCHES)[number], boolean>;

  const email = Object.fromEntries(
    EMAIL_SWITCHES.map((key) => [key, String(formData.get(key) ?? "true") === "true"]),
  ) as Record<(typeof EMAIL_SWITCHES)[number], boolean>;

  if (appName.length < 1) return { ok: false, error: "App name is required." };

  const data = {
    appName,
    allowSelfRecognition,
    autoCreateGoogleUsers,
    ...chat,
    ...email,
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
