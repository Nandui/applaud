"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { isProjectBlobUrl } from "@/lib/blob";
import {
  DEFAULT_BANNER,
  DEFAULT_THEME,
  KIND_LABELS,
  MAX_ITEM_PRICE,
  isKind,
  isRarity,
  type CosmeticKind,
} from "@/lib/cosmetics";

/**
 * Admin > Store: manage the profile Store catalogue (the `Cosmetic` table).
 * Pictures are uploaded straight to Vercel Blob by the browser through
 * /api/admin/reward/upload; these actions only store the resulting URL.
 */

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const NAME_MAX = 40;
const HEX = /^#[0-9a-fA-F]{6}$/;

function revalidateStore() {
  revalidatePath("/admin/store");
  revalidatePath("/shop");
  // Frames and banners show on the feed, profiles and people lists.
  revalidatePath("/", "layout");
}

function parsePrice(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  const n = Number(s);
  return s !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_ITEM_PRICE ? n : null;
}

/** A category id from a form or input: "" means none; unknown ids are an error. */
async function parseCategory(raw: FormDataEntryValue | string | null | undefined): Promise<string | null | false> {
  const id = String(raw ?? "").trim();
  if (!id) return null;
  const found = await prisma.cosmeticCategory.findUnique({ where: { id }, select: { id: true } });
  return found ? found.id : false;
}

/** Next sort position at the end of a kind's list. */
async function nextSortOrder(kind: CosmeticKind): Promise<number> {
  const last = await prisma.cosmetic.aggregate({ _max: { sortOrder: true }, where: { kind } });
  return (last._max.sortOrder ?? 0) + 10;
}

/** Create or edit one Store item. */
export async function saveCosmetic(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price = parsePrice(formData.get("price"));
  const rarity = String(formData.get("rarity") ?? "common");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const colour = String(formData.get("colour") ?? "").trim();
  const active = String(formData.get("active") ?? "true") === "true";
  const categoryId = await parseCategory(formData.get("categoryId"));

  if (name.length < 1 || name.length > NAME_MAX) {
    return { ok: false, error: `Give it a name of up to ${NAME_MAX} characters.` };
  }
  if (categoryId === false) return { ok: false, error: "That category no longer exists." };
  if (price === null) return { ok: false, error: "Enter a whole number of points (0 makes it free for everyone)." };
  if (!isRarity(rarity)) return { ok: false, error: "Pick a rarity." };
  if (imageUrl && !isProjectBlobUrl(imageUrl)) return { ok: false, error: "Unrecognised picture URL." };

  const existing = id ? await prisma.cosmetic.findUnique({ where: { id } }) : null;
  if (id && !existing) return { ok: false, error: "That item no longer exists." };
  const kind = existing?.kind ?? String(formData.get("kind") ?? "");
  if (!isKind(kind)) return { ok: false, error: "Pick what kind of item this is." };

  // What draws the item. Themes are a colour; frames and banners are a picture,
  // or (built-in items only) their original CSS style when the picture is removed.
  let style = existing?.style ?? null;
  if (kind === "theme") {
    if (!HEX.test(colour)) return { ok: false, error: "Pick a colour like #6a4dff." };
    style = colour.toLowerCase();
  } else if (!imageUrl && !style) {
    return { ok: false, error: `Upload a picture for this ${KIND_LABELS[kind].one.toLowerCase()}.` };
  }
  const isDefault = id === DEFAULT_BANNER || id === DEFAULT_THEME;
  if (isDefault && (price !== 0 || !active)) {
    return { ok: false, error: "This is everyone's default, so it stays free and in the Store." };
  }

  const data = { name, price, rarity, style, imageUrl: kind === "theme" ? null : imageUrl, active, categoryId };
  let entityId = id;
  if (existing) {
    await prisma.cosmetic.update({ where: { id }, data });
  } else {
    const created = await prisma.cosmetic.create({
      data: { ...data, kind, sortOrder: await nextSortOrder(kind) },
    });
    entityId = created.id;
  }
  await writeAudit({
    actor: admin,
    action: existing ? "cosmetic.updated" : "cosmetic.created",
    entityType: "cosmetic",
    entityId,
    summary: `${existing ? "Updated" : "Added"} Store ${KIND_LABELS[kind].one.toLowerCase()} ${name} (${price} pts)`,
    metadata: { kind, price, rarity, active, imageUrl: data.imageUrl, categoryId },
  });
  revalidateStore();
  return { ok: true, message: existing ? "Item saved." : `${name} added to the Store.` };
}

/**
 * Add several pictures at once as new frames or banners, each named after its
 * file. Admins fix names and prices afterwards.
 */
export async function addCosmeticsInBulk(input: {
  kind: CosmeticKind;
  price: number;
  active: boolean;
  categoryId?: string | null;
  items: { name: string; imageUrl: string }[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { kind, price, active } = input;
  const categoryId = await parseCategory(input.categoryId);
  if (categoryId === false) return { ok: false, error: "That category no longer exists." };
  if (kind !== "frame" && kind !== "banner") return { ok: false, error: "Only frames and banners use pictures." };
  if (!Number.isInteger(price) || price < 0 || price > MAX_ITEM_PRICE) {
    return { ok: false, error: "Enter a whole number of points." };
  }
  const items = input.items
    .map((i) => ({ name: i.name.trim().slice(0, NAME_MAX) || "New item", imageUrl: i.imageUrl.trim() }))
    .filter((i) => isProjectBlobUrl(i.imageUrl));
  if (items.length === 0) return { ok: false, error: "No pictures were uploaded." };
  if (items.length > 50) return { ok: false, error: "Add up to 50 at a time." };

  let sortOrder = await nextSortOrder(kind);
  await prisma.cosmetic.createMany({
    data: items.map((i) => {
      const row = { kind, name: i.name, price, rarity: "common", imageUrl: i.imageUrl, active, sortOrder, categoryId };
      sortOrder += 10;
      return row;
    }),
  });
  await writeAudit({
    actor: admin,
    action: "cosmetic.created",
    entityType: "cosmetic",
    summary: `Added ${items.length} Store ${KIND_LABELS[kind].many.toLowerCase()} (${price} pts each)`,
    metadata: { kind, price, active, categoryId, names: items.map((i) => i.name) },
  });
  revalidateStore();
  return {
    ok: true,
    message: `${items.length} ${items.length === 1 ? KIND_LABELS[kind].one.toLowerCase() : KIND_LABELS[kind].many.toLowerCase()} added${active ? " to the Store" : " (hidden)"}.`,
  };
}

/** Show or hide an item in the Store. People who own it keep wearing it. */
export async function setCosmeticActive(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!active && (id === DEFAULT_BANNER || id === DEFAULT_THEME)) {
    return { ok: false, error: "This is everyone's default, so it stays in the Store." };
  }
  const item = await prisma.cosmetic.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: "cosmetic.updated",
    entityType: "cosmetic",
    entityId: id,
    summary: `${active ? "Showed" : "Hid"} Store item ${item.name}`,
    metadata: { active },
  });
  revalidateStore();
  return { ok: true, message: active ? "Back in the Store." : "Hidden from the Store." };
}

/** Swap an item with its neighbour in its kind's list. */
export async function moveCosmetic(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  const item = await prisma.cosmetic.findUnique({ where: { id } });
  if (!item) return { ok: false, error: "That item no longer exists." };
  const siblings = await prisma.cosmetic.findMany({
    where: { kind: item.kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return { ok: true };
  const order = siblings.map((s) => s.id);
  [order[index], order[target]] = [order[target], order[index]];
  await prisma.$transaction(
    order.map((itemId, i) => prisma.cosmetic.update({ where: { id: itemId }, data: { sortOrder: (i + 1) * 10 } })),
  );
  revalidateStore();
  return { ok: true };
}

/**
 * Delete an item nobody has bought (a mistake or a test upload). Anything
 * someone has paid for can only be hidden, so they keep it.
 */
export async function deleteCosmetic(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (id === DEFAULT_BANNER || id === DEFAULT_THEME) {
    return { ok: false, error: "This is everyone's default, so it can't be deleted." };
  }
  const item = await prisma.cosmetic.findUnique({ where: { id } });
  if (!item) return { ok: true };
  const bought = await prisma.rewardLedger.count({ where: { type: "SHOP", sourceType: "cosmetic", sourceId: id } });
  if (bought > 0) {
    return { ok: false, error: `${bought} ${bought === 1 ? "person has" : "people have"} bought this. Hide it instead.` };
  }
  await prisma.cosmetic.delete({ where: { id } });
  await writeAudit({
    actor: admin,
    action: "cosmetic.deleted",
    entityType: "cosmetic",
    entityId: id,
    summary: `Deleted Store item ${item.name}`,
    metadata: { kind: item.kind, imageUrl: item.imageUrl },
  });
  revalidateStore();
  return { ok: true, message: "Deleted." };
}

// ---------- Categories ----------

const CATEGORY_MAX = 30;

/** Create or rename a Store category, or show/hide it. */
export async function saveCategory(input: { id?: string; name: string; active: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (name.length < 1 || name.length > CATEGORY_MAX) {
    return { ok: false, error: `Give the category a name of up to ${CATEGORY_MAX} characters.` };
  }
  const clash = await prisma.cosmeticCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false, error: `There's already a category called ${name}.` };

  let entityId = input.id;
  if (input.id) {
    const existing = await prisma.cosmeticCategory.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return { ok: false, error: "That category no longer exists." };
    await prisma.cosmeticCategory.update({ where: { id: input.id }, data: { name, active: input.active } });
  } else {
    const last = await prisma.cosmeticCategory.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.cosmeticCategory.create({
      data: { name, active: input.active, sortOrder: (last._max.sortOrder ?? 0) + 10 },
    });
    entityId = created.id;
  }
  await writeAudit({
    actor: admin,
    action: input.id ? "cosmetic.category.updated" : "cosmetic.category.created",
    entityType: "cosmetic_category",
    entityId,
    summary: `${input.id ? "Updated" : "Added"} Store category ${name}`,
    metadata: { active: input.active },
  });
  revalidateStore();
  return { ok: true, message: input.id ? "Category saved." : `${name} added.` };
}

/** Swap a category with its neighbour. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  const all = await prisma.cosmeticCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = all.findIndex((c) => c.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= all.length) return { ok: true };
  const order = all.map((c) => c.id);
  [order[index], order[target]] = [order[target], order[index]];
  await prisma.$transaction(
    order.map((catId, i) => prisma.cosmeticCategory.update({ where: { id: catId }, data: { sortOrder: (i + 1) * 10 } })),
  );
  revalidateStore();
  return { ok: true };
}

/**
 * Delete a category. Its items stay in the Store (and with whoever bought
 * them); they just go back to being listed by kind.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const category = await prisma.cosmeticCategory.findUnique({ where: { id } });
  if (!category) return { ok: true };
  await prisma.$transaction([
    prisma.cosmetic.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
    prisma.cosmeticCategory.delete({ where: { id } }),
  ]);
  await writeAudit({
    actor: admin,
    action: "cosmetic.category.deleted",
    entityType: "cosmetic_category",
    entityId: id,
    summary: `Deleted Store category ${category.name}`,
  });
  revalidateStore();
  return { ok: true, message: "Category deleted. Its items are still in the Store." };
}
