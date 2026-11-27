"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { writeAudit } from "@/lib/audit";
import { announceSuggestion } from "@/lib/suggestion-announce";
import {
  DAILY_LIMIT,
  DETAILS_MAX,
  NOTE_MAX,
  ADMIN_STATUS_LABELS,
  TITLE_MAX,
  isSuggestionKind,
  isSuggestionStatus,
  shouldAnnounce,
} from "@/lib/suggestions";

export type SuggestionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
export type VoteResult = { ok: true; voted: boolean; count: number } | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const cleanLong = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim().replace(/\n{3,}/g, "\n\n") : "");

function refresh() {
  revalidatePath("/rewards/ideas");
  revalidatePath("/admin/suggestions");
}

/** Post an idea. The person who posts it counts as its first upvote. */
export async function createSuggestion(formData: FormData): Promise<SuggestionResult> {
  const me = await requireUser();
  const kind = formData.get("kind");
  const title = clean(formData.get("title"));
  const details = cleanLong(formData.get("details"));
  if (!isSuggestionKind(kind)) return { ok: false, error: "Pick Rewards or Profile shop." };
  if (title.length < 3) return { ok: false, error: "Say what you'd like in a few words." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Keep the idea under ${TITLE_MAX} characters.` };
  if (details.length > DETAILS_MAX) return { ok: false, error: `Keep the details under ${DETAILS_MAX} characters.` };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.suggestion.count({ where: { userId: me.id, createdAt: { gte: since } } });
  if (recent >= DAILY_LIMIT) {
    return { ok: false, error: `That's ${DAILY_LIMIT} ideas today. Upvote others' or try again tomorrow.` };
  }

  // Same idea from the same person still open: don't post it twice.
  const dupe = await prisma.suggestion.findFirst({
    where: { userId: me.id, kind, title: { equals: title, mode: "insensitive" }, status: { in: ["new", "planned"] } },
    select: { id: true },
  });
  if (dupe) return { ok: false, error: "You've already suggested that." };

  const created = await prisma.suggestion.create({
    data: {
      kind,
      title,
      details: details || null,
      userId: me.id,
      voteCount: 1,
      votes: { create: { userId: me.id } },
    },
    select: { id: true },
  });
  await writeAudit({
    actor: me,
    action: "suggestion.created",
    entityType: "suggestion",
    entityId: created.id,
    summary: `${me.name} suggested a ${kind === "shop" ? "profile shop item" : "reward"}: ${title}`,
  });
  refresh();
  return { ok: true, message: "Thanks! Your idea is in.", id: created.id };
}

/** Upvote an idea, or take your upvote back. */
export async function toggleSuggestionVote(formData: FormData): Promise<VoteResult> {
  const me = await requireUser();
  const id = clean(formData.get("id"));
  if (!id) return { ok: false, error: "Missing idea." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const idea = await tx.suggestion.findUnique({ where: { id }, select: { status: true } });
      if (!idea) throw new Error("This idea was removed.");
      if (idea.status === "declined" || idea.status === "added") {
        throw new Error("Voting on this idea has closed.");
      }
      const existing = await tx.suggestionVote.findUnique({
        where: { suggestionId_userId: { suggestionId: id, userId: me.id } },
      });
      if (existing) {
        await tx.suggestionVote.delete({ where: { suggestionId_userId: { suggestionId: id, userId: me.id } } });
      } else {
        await tx.suggestionVote.create({ data: { suggestionId: id, userId: me.id } });
      }
      // Recount rather than +/-1 so the cache can't drift under double taps.
      const count = await tx.suggestionVote.count({ where: { suggestionId: id } });
      await tx.suggestion.update({ where: { id }, data: { voteCount: count } });
      return { voted: !existing, count };
    });
    refresh();
    return { ok: true, ...result };
  } catch (e) {
    // A double tap can race to create the same vote; the unique key refuses the second.
    if (e instanceof Error && !("code" in e)) return { ok: false, error: e.message };
    return { ok: false, error: "Couldn't save your vote. Try again." };
  }
}

/** Remove an idea: its author while nobody has decided on it yet, or an admin any time. */
export async function deleteSuggestion(formData: FormData): Promise<SuggestionResult> {
  const me = await requireUser();
  const id = clean(formData.get("id"));
  const idea = await prisma.suggestion.findUnique({ where: { id }, select: { userId: true, status: true, title: true } });
  if (!idea) return { ok: false, error: "This idea was already removed." };
  const admin = isAdmin(me);
  if (!admin && (idea.userId !== me.id || idea.status !== "new")) {
    return { ok: false, error: "You can't remove this idea." };
  }
  await prisma.suggestion.delete({ where: { id } });
  await writeAudit({
    actor: me,
    action: "suggestion.deleted",
    entityType: "suggestion",
    entityId: id,
    summary: `${me.name} removed the idea "${idea.title}"`,
  });
  refresh();
  return { ok: true, message: "Idea removed" };
}

/**
 * Admin: approve, decline or mark an idea available, with the reply everyone
 * sees on it. Marking it Available needs the reward or profile item it became;
 * the first time that happens the suggester is emailed and the Chat space told.
 */
export async function updateSuggestion(formData: FormData): Promise<SuggestionResult> {
  const me = await requireAdmin();
  const id = clean(formData.get("id"));
  const status = formData.get("status");
  const noteRaw = formData.get("adminNote");
  const adminNote = noteRaw === null ? undefined : cleanLong(noteRaw);
  const itemRaw = formData.get("itemId");
  const itemId = itemRaw === null ? undefined : clean(itemRaw) || null;
  if (!isSuggestionStatus(status)) return { ok: false, error: "Unknown status." };
  if (adminNote && adminNote.length > NOTE_MAX) return { ok: false, error: `Keep the reply under ${NOTE_MAX} characters.` };

  const idea = await prisma.suggestion.findUnique({
    where: { id },
    select: { status: true, title: true, kind: true, rewardId: true, cosmeticId: true, announcedAt: true },
  });
  if (!idea) return { ok: false, error: "This idea was removed." };
  const shop = idea.kind === "shop";

  // Only an available idea points at an item; any other status unlinks it.
  let linked = status === "added" ? (itemId === undefined ? (shop ? idea.cosmeticId : idea.rewardId) : itemId) : null;
  let itemName: string | null = null;
  if (linked) {
    const item = shop
      ? await prisma.cosmetic.findUnique({ where: { id: linked }, select: { name: true, active: true } })
      : await prisma.reward.findUnique({ where: { id: linked }, select: { name: true, active: true } });
    if (!item) {
      if (itemId !== undefined) return { ok: false, error: "That item no longer exists. Pick another." };
      linked = null;
    } else if (!item.active && itemId !== undefined && itemId !== (shop ? idea.cosmeticId : idea.rewardId)) {
      return { ok: false, error: `${item.name} is hidden. Show it first, or pick another.` };
    } else itemName = item.name;
  }
  if (status === "added" && !linked && idea.status !== "added") {
    return { ok: false, error: shop ? "Pick the profile shop item this idea became." : "Pick the reward this idea became." };
  }

  const announce = shouldAnnounce({ status, itemId: linked, announcedAt: idea.announcedAt });
  await prisma.suggestion.update({
    where: { id },
    data: {
      status,
      ...(adminNote === undefined ? {} : { adminNote: adminNote || null }),
      ...(status !== idea.status ? { statusChangedAt: new Date() } : {}),
      ...(shop ? { cosmeticId: linked } : { rewardId: linked }),
      ...(announce ? { announcedAt: new Date() } : {}),
    },
  });
  if (announce) after(() => announceSuggestion(id));

  await writeAudit({
    actor: me,
    action: "suggestion.updated",
    entityType: "suggestion",
    entityId: id,
    summary: `${me.name} set "${idea.title}" to ${ADMIN_STATUS_LABELS[status]}${itemName ? ` (${itemName})` : ""}`,
    metadata: { from: idea.status, to: status, itemId: linked, announced: announce },
  });
  refresh();
  revalidatePath(shop ? "/shop" : "/rewards");
  const message =
    announce ? "Available! We're letting everyone know." : status === "planned" && idea.status !== "planned" ? "Approved" : "Saved";
  return { ok: true, message };
}
