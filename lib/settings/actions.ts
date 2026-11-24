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
  const allowSelfRecognition =
    String(formData.get("allowSelfRecognition") ?? "false") === "true";
  const autoCreateGoogleUsers =
    String(formData.get("autoCreateGoogleUsers") ?? "true") === "true";

  const flag = (name: string) => String(formData.get(name) ?? "true") === "true";
  const emailRecipients = flag("emailRecipients");
  const emailEveryone = flag("emailEveryone");
  const emailTestMode = flag("emailTestMode");
  const emailTestAddress = String(formData.get("emailTestAddress") ?? "").trim().toLowerCase();

  if (appName.length < 1) return { ok: false, error: "App name is required." };
  if (emailTestAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTestAddress)) {
    return { ok: false, error: "The test email address doesn't look right." };
  }
  if (emailTestMode && !emailTestAddress) {
    return { ok: false, error: "Test mode needs an address to send to." };
  }

  const data = {
    appName,
    allowSelfRecognition,
    autoCreateGoogleUsers,
    emailRecipients,
    emailEveryone,
    emailTestMode,
    emailTestAddress,
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
