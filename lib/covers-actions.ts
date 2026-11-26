"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { postToGoogleChat } from "@/lib/chat/google-chat";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { getMonthlyCoverUsage } from "@/lib/points";
import { MAX_RECOGNITION_IMAGES } from "@/lib/config";
import { isGiphyMediaUrl } from "@/lib/recognition/gif";
import { isProjectBlobUrl } from "@/lib/blob";
import { writeAudit } from "@/lib/audit";
import {
  COVER_TYPES,
  COVER_WHAT_MAX,
  canThankForCovers,
  coverAllowanceForRank,
} from "@/lib/covers";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

class CoverAllowanceError extends Error {}

const attachmentUrl = z
  .string()
  .url()
  .refine((value) => isProjectBlobUrl(value) || isGiphyMediaUrl(value), "Unrecognised image URL.");

const coverSchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1, "Pick who covered.").max(10),
  coverType: z.enum(COVER_TYPES, { message: "Say what they covered." }),
  coverWhat: z
    .string()
    .trim()
    .min(2, "Say which one they covered.")
    .max(COVER_WHAT_MAX, `Keep it under ${COVER_WHAT_MAX} characters.`),
  message: z.string().trim().max(500),
  points: z.coerce.number().int().min(0).max(100_000),
  imageUrls: z
    .array(attachmentUrl)
    .max(MAX_RECOGNITION_IMAGES, `Attach at most ${MAX_RECOGNITION_IMAGES} images.`)
    .default([]),
});

/**
 * Thank people for covering a lesson, activity or shift at short notice.
 * Only Manager, Centre manager, Operations manager and CEO ranks can, and the
 * points come from their separate monthly cover allowance. In one transaction
 * (holding a per-person lock so two quick taps can't overspend): checks the
 * allowance, writes the Recognition (kind "cover") with its recipients, and
 * one COVER ledger row per recipient.
 */
export async function createCover(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireUser();
  if (!canThankForCovers(me)) {
    return { ok: false, error: "Only managers and above can thank people for covering." };
  }

  const parsed = coverSchema.safeParse({
    recipientIds: formData.getAll("recipientIds").map(String),
    coverType: formData.get("coverType"),
    coverWhat: formData.get("coverWhat") ?? "",
    message: formData.get("message") ?? "",
    points: formData.get("points") ?? 0,
    imageUrls: formData.getAll("imageUrls").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { coverType, coverWhat, points, imageUrls } = parsed.data;
  const recipientIds = [...new Set(parsed.data.recipientIds)];
  // Without a note of their own, the post says what was covered.
  const message =
    parsed.data.message ||
    `Thanks for stepping in at short notice to cover ${coverWhat}.`;

  if (recipientIds.includes(me.id)) {
    return { ok: false, error: "You can't thank yourself for covering." };
  }
  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds }, active: true },
    select: { id: true, name: true },
  });
  if (recipients.length !== recipientIds.length) {
    return { ok: false, error: "One or more people are invalid." };
  }

  const settings = await getOrgSettings();
  if (settings.maxPointsPerCover > 0 && points > settings.maxPointsPerCover) {
    return { ok: false, error: `A cover can carry at most ${settings.maxPointsPerCover} points per person.` };
  }
  const totalPoints = points * recipientIds.length;
  let createdId: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      if (totalPoints > 0) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cover:${me.id}`})::bigint)`;
        const used = await getMonthlyCoverUsage(me.id, new Date(), tx);
        const allowance = coverAllowanceForRank(me.pointsRank, settings);
        if (used + totalPoints > allowance) {
          throw new CoverAllowanceError(
            `That's more than you have left for covers this month (${Math.max(0, allowance - used)}).`,
          );
        }
      }

      const cover = await tx.recognition.create({
        data: {
          kind: "cover",
          senderId: me.id,
          message,
          visibility: "public",
          imageUrls,
          coverType,
          coverWhat,
          recipients: { create: recipientIds.map((userId) => ({ userId, points })) },
        },
      });
      createdId = cover.id;

      if (points > 0) {
        for (const userId of recipientIds) {
          await tx.rewardLedger.create({
            data: {
              userId,
              amount: points,
              type: "COVER",
              sourceType: "recognition_recipient",
              sourceId: cover.id,
              note: `Thanks from ${me.name} for covering`,
            },
          });
          await tx.user.update({
            where: { id: userId },
            data: { walletBalance: { increment: points } },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof CoverAllowanceError) return { ok: false, error: error.message };
    throw error;
  }

  if (createdId) {
    const id = createdId;
    after(() => postToGoogleChat({
      kind: "cover", id, from: me.name, to: recipients.map((r) => r.name), what: coverWhat, points,
      image: imageUrls[0] ?? null,
    }));
  }

  await writeAudit({
    actor: me,
    action: "cover.created",
    entityType: "recognition",
    entityId: createdId,
    summary: `Thanked ${recipientIds.length} ${recipientIds.length === 1 ? "person" : "people"} for covering ${coverWhat} (${points} pts each)`,
    metadata: { recipientIds, points, coverType, coverWhat },
    siteId: me.siteId,
  });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/leaderboard");
  return { ok: true, message: "Thanks shared!" };
}
