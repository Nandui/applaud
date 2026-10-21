"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { isProjectBlobUrl } from "@/lib/blob";
import { getProfileData } from "@/lib/profile";
import { profileInputSchema, toStoredProfile } from "@/lib/profile-custom";

export type ProfileActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Save the signed-in person's own profile customization. Decorations they
 * haven't earned and pins that aren't recognitions they received are dropped
 * server-side, whatever the client sent.
 */
export async function updateMyProfile(
  _prev: ProfileActionResult | undefined,
  formData: FormData,
): Promise<ProfileActionResult> {
  const me = await requireUser();

  const parsed = profileInputSchema.safeParse({
    pronouns: formData.get("pronouns") ?? "",
    bio: formData.get("bio") ?? "",
    statusEmoji: formData.get("statusEmoji") ?? "",
    statusText: formData.get("statusText") ?? "",
    themePrimary: formData.get("themePrimary") || undefined,
    themeAccent: formData.get("themeAccent") || undefined,
    decoration: formData.get("decoration") ?? "",
    pinned: formData.getAll("pinned").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your profile details." };
  }

  const data = await getProfileData(me.id);
  if (!data) return { ok: false, error: "Profile not found." };

  const pinnable = parsed.data.pinned.length
    ? await prisma.recognitionRecipient.findMany({
        where: { userId: me.id, recognitionId: { in: parsed.data.pinned } },
        select: { recognitionId: true },
      })
    : [];

  const stored = toStoredProfile(parsed.data, {
    decorations: data.unlocked,
    pinnable: new Set(pinnable.map((p) => p.recognitionId)),
  });

  await prisma.user.update({ where: { id: me.id }, data: { profile: stored } });
  await writeAudit({
    actor: me,
    action: "profile.updated",
    entityType: "user",
    entityId: me.id,
    summary: "Customised their profile",
    siteId: me.siteId,
  });

  revalidatePath(`/profile/${me.id}`);
  return { ok: true, message: "Profile saved" };
}

/** Set (or clear) the signed-in person's own profile picture. */
export async function setMyAvatar(url: string | null): Promise<ProfileActionResult> {
  const me = await requireUser();
  const value = url?.trim() || null;
  if (value && !isProjectBlobUrl(value)) {
    return { ok: false, error: "Unrecognised image URL." };
  }
  await prisma.user.update({ where: { id: me.id }, data: { avatarUrl: value } });
  await writeAudit({
    actor: me,
    action: "profile.updated",
    entityType: "user",
    entityId: me.id,
    summary: value ? "Changed their profile picture" : "Removed their profile picture",
    siteId: me.siteId,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Pin or unpin one received recognition from the feed card menu. */
export async function togglePin(recognitionId: string): Promise<ProfileActionResult> {
  const me = await requireUser();
  const data = await getProfileData(me.id);
  if (!data) return { ok: false, error: "Profile not found." };

  const received = await prisma.recognitionRecipient.findFirst({
    where: { userId: me.id, recognitionId },
    select: { id: true },
  });
  if (!received) return { ok: false, error: "You can only pin shout-outs you received." };

  const current = data.custom.pinned;
  const isPinned = current.includes(recognitionId);
  if (!isPinned && current.length >= 3) {
    return { ok: false, error: "You can pin up to 3. Unpin one first." };
  }
  const pinned = isPinned
    ? current.filter((id) => id !== recognitionId)
    : [...current, recognitionId];

  const stored = toStoredProfile(
    {
      pronouns: data.custom.pronouns,
      bio: data.custom.bio,
      statusEmoji: data.custom.status?.emoji ?? "",
      statusText: data.custom.status?.text ?? "",
      themePrimary: data.custom.themed ? data.custom.theme.primary : undefined,
      themeAccent: data.custom.themed ? data.custom.theme.accent : undefined,
      decoration: data.custom.decoration ?? "",
      pinned,
    },
    { decorations: data.unlocked, pinnable: new Set(pinned) },
  );
  await prisma.user.update({ where: { id: me.id }, data: { profile: stored } });
  revalidatePath(`/profile/${me.id}`);
  return { ok: true, message: isPinned ? "Unpinned" : "Pinned to your profile" };
}
