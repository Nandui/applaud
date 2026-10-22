"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { isProjectBlobUrl } from "@/lib/blob";
import { KIND_LABELS, itemById, type CosmeticKind } from "@/lib/cosmetics";
import { getCatalogue, getCategories } from "@/lib/catalogue";
import {
  MAX_PINNED,
  bundleFor,
  ownsItem,
  parseProfile,
  profileInputSchema,
  withEquipped,
  withOwned,
  withPurchase,
  type ProfileCustom,
} from "@/lib/profile-custom";

export type ProfileActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

class ShopError extends Error {}

async function loadCustom(userId: string): Promise<ProfileCustom> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profile: true } });
  return parseProfile(row.profile);
}

function revalidateProfile(userId: string) {
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/shop");
}

/** Save the signed-in person's pronouns and bio. */
export async function updateMyProfile(
  _prev: ProfileActionResult | undefined,
  formData: FormData,
): Promise<ProfileActionResult> {
  const me = await requireUser();
  const parsed = profileInputSchema.safeParse({
    pronouns: formData.get("pronouns") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your profile details." };
  }

  const custom = await loadCustom(me.id);
  await prisma.user.update({
    where: { id: me.id },
    data: { profile: { ...custom, ...parsed.data } },
  });
  await writeAudit({
    actor: me,
    action: "profile.updated",
    entityType: "user",
    entityId: me.id,
    summary: "Updated their bio",
    siteId: me.siteId,
  });
  revalidateProfile(me.id);
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
  const received = await prisma.recognitionRecipient.findFirst({
    where: { userId: me.id, recognitionId },
    select: { id: true },
  });
  if (!received) return { ok: false, error: "You can only pin shout-outs you received." };

  const custom = await loadCustom(me.id);
  const isPinned = custom.pinned.includes(recognitionId);
  if (!isPinned && custom.pinned.length >= MAX_PINNED) {
    return { ok: false, error: `You can pin up to ${MAX_PINNED}. Unpin one first.` };
  }
  const pinned = isPinned
    ? custom.pinned.filter((id) => id !== recognitionId)
    : [...custom.pinned, recognitionId];
  await prisma.user.update({ where: { id: me.id }, data: { profile: { ...custom, pinned } } });
  revalidateProfile(me.id);
  return { ok: true, message: isPinned ? "Unpinned" : "Pinned to your profile" };
}

/**
 * Buy a profile shop item with points, then wear it. The spend is a SHOP entry
 * in the wallet ledger, checked against the live ledger balance inside the
 * same transaction as the purchase (like reward redemptions).
 */
export async function buyItem(itemId: string): Promise<ProfileActionResult> {
  const me = await requireUser();
  const item = itemById(await getCatalogue(), itemId);
  if (!item || !item.active) return { ok: false, error: "That item isn't in the shop." };

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.user.findUniqueOrThrow({ where: { id: me.id }, select: { profile: true } });
      const custom = parseProfile(row.profile);
      if (ownsItem(custom, item)) throw new ShopError("You already own this.");

      if (item.price > 0) {
        const agg = await tx.rewardLedger.aggregate({ _sum: { amount: true }, where: { userId: me.id } });
        if ((agg._sum.amount ?? 0) < item.price) throw new ShopError("You don't have enough points yet.");
        await tx.user.update({ where: { id: me.id }, data: { walletBalance: { decrement: item.price } } });
      }
      // Free items get a 0-point entry too, so claims count as buyers in Admin > Store.
      await tx.rewardLedger.create({
        data: {
          userId: me.id,
          amount: 0 - item.price,
          type: "SHOP",
          sourceType: "cosmetic",
          sourceId: item.id,
          note: `${item.name} ${KIND_LABELS[item.kind].one.toLowerCase()}`,
        },
      });
      await tx.user.update({ where: { id: me.id }, data: { profile: withPurchase(custom, item) } });
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, error: error.message };
    throw error;
  }

  await writeAudit({
    actor: me,
    action: "shop.purchased",
    entityType: "user",
    entityId: me.id,
    summary: `${item.price === 0 ? "Claimed" : "Bought"} ${item.name} (${KIND_LABELS[item.kind].one}, ${item.price} pts)`,
    metadata: { itemId: item.id, price: item.price },
    siteId: me.siteId,
  });
  revalidateProfile(me.id);
  revalidatePath("/me");
  return { ok: true, message: `${item.name} is yours! It's on your profile now.` };
}

/**
 * Buy every item in a Store category that you don't own yet, at the plain sum
 * of their prices (no discount). Each item gets its own SHOP entry in the
 * wallet ledger, exactly as if bought one by one, so wallet history, buyer
 * counts and the Points analytics stay the same. Nothing is equipped.
 * `expectedPrice` is what the buyer was shown; if prices or ownership changed
 * since, the purchase stops instead of charging a different amount.
 */
export async function buyBundle(categoryId: string, expectedPrice: number): Promise<ProfileActionResult> {
  const me = await requireUser();
  const [catalogue, categories] = await Promise.all([getCatalogue(), getCategories()]);
  const category = categories.find((c) => c.id === categoryId);
  if (!category || !category.active) return { ok: false, error: "That bundle isn't in the shop." };

  let bought: ReturnType<typeof bundleFor> = { items: [], price: 0 };
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.user.findUniqueOrThrow({ where: { id: me.id }, select: { profile: true } });
      const custom = parseProfile(row.profile);
      bought = bundleFor(custom, catalogue, category.id);
      if (bought.items.length === 0) throw new ShopError("You already own everything in this bundle.");
      if (bought.price !== expectedPrice) {
        throw new ShopError("This bundle changed since you opened it. Have another look and try again.");
      }

      if (bought.price > 0) {
        const agg = await tx.rewardLedger.aggregate({ _sum: { amount: true }, where: { userId: me.id } });
        if ((agg._sum.amount ?? 0) < bought.price) throw new ShopError("You don't have enough points yet.");
        await tx.user.update({ where: { id: me.id }, data: { walletBalance: { decrement: bought.price } } });
      }
      await tx.rewardLedger.createMany({
        data: bought.items.map((item) => ({
          userId: me.id,
          amount: 0 - item.price,
          type: "SHOP",
          sourceType: "cosmetic",
          sourceId: item.id,
          note: `${item.name} ${KIND_LABELS[item.kind].one.toLowerCase()} (${category.name} bundle)`,
        })),
      });
      await tx.user.update({ where: { id: me.id }, data: { profile: withOwned(custom, bought.items) } });
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, error: error.message };
    throw error;
  }

  const { items, price } = bought;
  await writeAudit({
    actor: me,
    action: "shop.purchased",
    entityType: "user",
    entityId: me.id,
    summary: `Bought the ${category.name} bundle (${items.length} items, ${price} pts)`,
    metadata: { categoryId: category.id, itemIds: items.map((i) => i.id), price },
    siteId: me.siteId,
  });
  revalidateProfile(me.id);
  revalidatePath("/me");
  return {
    ok: true,
    message: `All of ${category.name} is yours! Tap any item to wear it.`,
  };
}

/** Wear an item you own, or take off whatever is in a slot (`itemId` null). */
export async function equipItem(kind: CosmeticKind, itemId: string | null): Promise<ProfileActionResult> {
  const me = await requireUser();
  const custom = await loadCustom(me.id);
  const item = itemId ? itemById(await getCatalogue(), itemId) : null;
  if (itemId && (!item || item.kind !== kind)) return { ok: false, error: "That item isn't in the shop." };
  if (item && !ownsItem(custom, item)) return { ok: false, error: "Buy it first." };
  await prisma.user.update({
    where: { id: me.id },
    data: { profile: withEquipped(custom, kind, item) },
  });
  revalidateProfile(me.id);
  return { ok: true, message: itemId ? "Equipped" : "Removed" };
}
