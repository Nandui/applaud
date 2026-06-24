"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function updateOrgSettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const appName = String(formData.get("appName") ?? "").trim();
  const monthlyAllowanceStaff = Math.max(
    0,
    Math.floor(Number(formData.get("monthlyAllowanceStaff"))),
  );
  const monthlyAllowanceManager = Math.max(
    0,
    Math.floor(Number(formData.get("monthlyAllowanceManager"))),
  );
  const expiryRaw = String(formData.get("pointsExpiryMonths") ?? "").trim();
  const pointsExpiryMonths =
    expiryRaw === "" ? null : Math.max(1, Math.floor(Number(expiryRaw)));
  const allowSelfRecognition =
    String(formData.get("allowSelfRecognition") ?? "false") === "true";

  if (appName.length < 1) return { ok: false, error: "App name is required." };
  if (!Number.isFinite(monthlyAllowanceStaff) || !Number.isFinite(monthlyAllowanceManager)) {
    return { ok: false, error: "Allowances must be numbers." };
  }
  if (pointsExpiryMonths !== null && !Number.isFinite(pointsExpiryMonths)) {
    return { ok: false, error: "Expiry must be a number of months or blank." };
  }

  const data = {
    appName,
    monthlyAllowanceStaff,
    monthlyAllowanceManager,
    pointsExpiryMonths,
    allowSelfRecognition,
  };
  await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved." };
}
