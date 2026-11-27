"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { canSeeRecognition } from "@/lib/recognition/live";
import {
  MAX_FEED_PINS,
  PIN_DURATIONS,
  canPinToFeed,
  canUnpinFromFeed,
  isPinActive,
  pinEndsAt,
  pinUntilLabel,
} from "@/lib/feed-pins";

/** Everywhere a card's menu can show. */
function revalidateCards() {
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  revalidatePath("/recognition/[id]", "page");
}

type Result = { ok: true; message: string } | { ok: false; error: string };

const pinSchema = z.object({
  recognitionId: z.string().min(1).max(64),
  choice: z.union([
    z.object({ duration: z.enum(PIN_DURATIONS.map((d) => d.key) as [string, ...string[]]) }),
    z.object({ untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  ]),
});

/**
 * Pin a recognition or post to the top of the Home feed until the chosen
 * time, or change how long an existing pin lasts.
 */
export async function pinToFeed(input: { recognitionId: string; choice: unknown }): Promise<Result> {
  const me = await requireUser();
  if (!canPinToFeed(me)) {
    return { ok: false, error: "Only managers and above can pin to the feed." };
  }
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick how long to pin it for." };
  const { recognitionId } = parsed.data;
  const choice = parsed.data.choice as Parameters<typeof pinEndsAt>[0];

  const now = new Date();
  const end = pinEndsAt(choice, now);
  if (!end.ok) return end;

  if (!(await canSeeRecognition(recognitionId, me.id))) {
    return { ok: false, error: "That post no longer exists." };
  }
  const row = await prisma.recognition.findUnique({
    where: { id: recognitionId },
    select: { id: true, kind: true, feedPinnedUntil: true, feedPinnedById: true, feedPinnedBy: { select: { name: true } } },
  });
  if (!row) return { ok: false, error: "That post no longer exists." };

  const already = isPinActive(row.feedPinnedUntil, now);
  if (already && !canUnpinFromFeed(me, row.feedPinnedById)) {
    return {
      ok: false,
      error: `${row.feedPinnedBy?.name ?? "Someone"} pinned this. Only they or an admin can change it.`,
    };
  }
  if (!already) {
    const active = await prisma.recognition.count({ where: { feedPinnedUntil: { gt: now } } });
    if (active >= MAX_FEED_PINS) {
      return {
        ok: false,
        error: `${MAX_FEED_PINS} things are pinned already. Unpin one first.`,
      };
    }
  }

  await prisma.recognition.update({
    where: { id: row.id },
    data: {
      feedPinnedUntil: end.until,
      // Changing the time keeps the original pinner and place in the pinned row.
      ...(already ? {} : { feedPinnedAt: now, feedPinnedById: me.id }),
    },
  });
  const label = pinUntilLabel(end.until, now);
  await writeAudit({
    actor: me,
    action: "feed.pinned",
    entityType: "recognition",
    entityId: row.id,
    summary: already ? `Changed a feed pin to ${label}` : `Pinned a ${row.kind === "recognition" ? "recognition" : row.kind} to the feed ${label}`,
    metadata: { until: end.until.toISOString(), kind: row.kind },
    siteId: me.siteId,
  });
  revalidateCards();
  return { ok: true, message: already ? `Pin changed, ${label}` : `Pinned to the top of the feed ${label}` };
}

/** Take a pin down early. The pinner and admins can. */
export async function unpinFromFeed(recognitionId: string): Promise<Result> {
  const me = await requireUser();
  const id = z.string().min(1).max(64).safeParse(recognitionId);
  if (!id.success) return { ok: false, error: "That post no longer exists." };
  const row = await prisma.recognition.findUnique({
    where: { id: id.data },
    select: { id: true, kind: true, feedPinnedUntil: true, feedPinnedById: true, feedPinnedBy: { select: { name: true } } },
  });
  if (!row || !isPinActive(row.feedPinnedUntil)) {
    revalidateCards();
    return { ok: true, message: "It's no longer pinned" };
  }
  if (!canUnpinFromFeed(me, row.feedPinnedById)) {
    return {
      ok: false,
      error: `${row.feedPinnedBy?.name ?? "Someone"} pinned this. Only they or an admin can unpin it.`,
    };
  }
  await prisma.recognition.update({
    where: { id: row.id },
    data: { feedPinnedUntil: null, feedPinnedAt: null, feedPinnedById: null },
  });
  const own = row.feedPinnedById === me.id;
  await writeAudit({
    actor: me,
    action: "feed.unpinned",
    entityType: "recognition",
    entityId: row.id,
    summary: own ? "Unpinned their feed pin" : `Unpinned a feed pin by ${row.feedPinnedBy?.name ?? "someone"}`,
    metadata: { kind: row.kind, pinnedById: row.feedPinnedById },
    siteId: me.siteId,
  });
  revalidateCards();
  return { ok: true, message: "Unpinned from the feed" };
}
