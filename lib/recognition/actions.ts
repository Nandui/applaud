"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { allowanceForRole, getMonthlyAllowanceUsage } from "@/lib/points";
import {
  MAX_RECOGNITION_IMAGES,
  REACTION_EMOJIS,
  BOOSTS,
  BOOST_TYPES,
  boostMultiplier,
  canApplyBoost,
  type BoostType,
} from "@/lib/config";
import { isGiphyMediaUrl } from "@/lib/recognition/gif";
import { isProjectBlobUrl } from "@/lib/blob";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

class AllowanceError extends Error {}
class BoostError extends Error {}

// An attachment URL is either an uploaded blob in THIS project's store, or a
// GIF picked from the library search (a GIPHY media URL). Both are world-
// readable, deterministic hosts — anything else is rejected.
const attachmentUrl = z
  .string()
  .url()
  .refine(
    (value) => isProjectBlobUrl(value) || isGiphyMediaUrl(value),
    "Unrecognised image URL.",
  );

const createSchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1, "Pick at least one recipient.").max(10),
  valueId: z.string().min(1, "Choose a value."),
  message: z.string().trim().min(3, "Write a short message.").max(500),
  points: z.coerce.number().int().min(0).max(100_000),
  visibility: z.enum(["public", "private"]).default("public"),
  imageUrls: z
    .array(attachmentUrl)
    .max(MAX_RECOGNITION_IMAGES, `Attach at most ${MAX_RECOGNITION_IMAGES} images.`)
    .default([]),
});

/**
 * Create a recognition. In ONE transaction: writes the Recognition + recipient
 * rows and one RewardLedger row per recipient (incrementing the cached wallet
 * balance). The allowance is re-checked inside the transaction to prevent
 * double-spend.
 */
export async function createRecognition(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireUser();

  const parsed = createSchema.safeParse({
    recipientIds: formData.getAll("recipientIds").map(String),
    valueId: formData.get("valueId"),
    message: formData.get("message"),
    points: formData.get("points") ?? 0,
    visibility: formData.get("visibility") ?? "public",
    imageUrls: formData.getAll("imageUrls").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { valueId, message, points, visibility, imageUrls } = parsed.data;
  const recipientIds = [...new Set(parsed.data.recipientIds)];
  const settings = await getOrgSettings();

  if (!settings.allowSelfRecognition && recipientIds.includes(me.id)) {
    return { ok: false, error: "You can't recognise yourself." };
  }

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds }, active: true },
    select: { id: true },
  });
  if (recipients.length !== recipientIds.length) {
    return { ok: false, error: "One or more recipients are invalid." };
  }

  const value = await prisma.value.findFirst({
    where: { id: valueId, active: true },
    select: { id: true },
  });
  if (!value) return { ok: false, error: "That value is unavailable." };

  const totalPoints = points * recipientIds.length;

  try {
    await prisma.$transaction(async (tx) => {
      if (totalPoints > 0) {
        const used = await getMonthlyAllowanceUsage(me.id, new Date(), tx);
        const allowance = allowanceForRole(me.role, settings);
        if (used + totalPoints > allowance) {
          throw new AllowanceError(
            `That would exceed your monthly allowance — ${Math.max(0, allowance - used)} left.`,
          );
        }
      }

      const recognition = await tx.recognition.create({
        data: {
          senderId: me.id,
          valueId,
          message,
          visibility,
          imageUrls,
          recipients: {
            create: recipientIds.map((userId) => ({ userId, points })),
          },
        },
      });

      if (points > 0) {
        for (const userId of recipientIds) {
          await tx.rewardLedger.create({
            data: {
              userId,
              amount: points,
              type: "RECOGNITION",
              sourceType: "recognition_recipient",
              sourceId: recognition.id,
              note: `Recognition from ${me.name}`,
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
    if (error instanceof AllowanceError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/me");
  return { ok: true, message: "Recognition posted!" };
}

const reactionSchema = z.object({
  recognitionId: z.string().min(1),
  emoji: z
    .string()
    .refine((e) => (REACTION_EMOJIS as readonly string[]).includes(e), "Invalid emoji."),
});

/**
 * Set the current user's single reaction on a recognition. One reaction per
 * person: the same emoji toggles it off, a different emoji switches it. Enforced
 * here and by the DB unique on (recognitionId, userId).
 */
export async function toggleReaction(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = reactionSchema.safeParse({
    recognitionId: formData.get("recognitionId"),
    emoji: formData.get("emoji"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid reaction." };
  const { recognitionId, emoji } = parsed.data;

  const existing = await prisma.reaction.findFirst({
    where: { recognitionId, userId: me.id },
    orderBy: { createdAt: "asc" },
  });
  if (!existing) {
    await prisma.reaction.create({
      data: { recognitionId, userId: me.id, emoji },
    });
  } else if (existing.emoji === emoji) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.update({
      where: { id: existing.id },
      data: { emoji },
    });
  }
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true };
}

const commentSchema = z.object({
  recognitionId: z.string().min(1),
  body: z.string().trim().min(1, "Write a comment.").max(500),
});

export async function addComment(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = commentSchema.safeParse({
    recognitionId: formData.get("recognitionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }
  await prisma.comment.create({
    data: {
      recognitionId: parsed.data.recognitionId,
      userId: me.id,
      body: parsed.data.body,
    },
  });
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true };
}

const boostSchema = z.object({
  recognitionId: z.string().min(1),
  type: z.enum(BOOST_TYPES as [BoostType, ...BoostType[]]),
});

/**
 * Apply / remove / upgrade a point-multiplier boost on a recognition.
 *
 * Boosts are mutually exclusive and the higher multiplier wins:
 *  - clicking your own boost when it's active toggles it off;
 *  - applying onto an empty recognition sets it;
 *  - a higher boost (CEO 5×) replaces a lower one (Operations 2×), but a lower
 *    boost can't downgrade a higher one.
 *
 * The wallet effect is booked to the append-only RewardLedger: each recipient
 * is credited the *delta* to reach the target multiple of the points they were
 * originally given, so applying, switching, and removing all net out exactly.
 * The whole thing runs in one transaction with an optimistic guard on the
 * recognition's current boost state to keep concurrent clicks consistent.
 */
export async function toggleBoost(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = boostSchema.safeParse({
    recognitionId: formData.get("recognitionId"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid boost." };
  const { recognitionId, type } = parsed.data;

  if (!canApplyBoost(me.role, type)) {
    return { ok: false, error: `Only ${BOOSTS[type].label} can apply that boost.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const rec = await tx.recognition.findUnique({
        where: { id: recognitionId },
        select: {
          id: true,
          boostType: true,
          recipients: { select: { userId: true, points: true } },
        },
      });
      if (!rec) throw new BoostError("That recognition no longer exists.");

      const current = (rec.boostType as BoostType | null) ?? null;

      // Decide the target boost state.
      let target: BoostType | null;
      if (current === type) {
        target = null; // toggle my boost off
      } else if (current === null) {
        target = type; // apply onto an un-boosted post
      } else if (boostMultiplier(type) > boostMultiplier(current)) {
        target = type; // upgrade (e.g. CEO over Operations)
      } else {
        throw new BoostError(
          `A ${BOOSTS[current].label} boost (${boostMultiplier(current)}×) is already applied.`,
        );
      }

      const totalBase = rec.recipients.reduce(
        (sum, r) => sum + Math.max(0, r.points),
        0,
      );
      if (target && totalBase <= 0) {
        throw new BoostError("This recognition has no points to boost.");
      }

      // Book the per-recipient delta: reverse the current boost's bonus, then
      // apply the target's. Base is the points originally granted per recipient.
      const removeMult = current ? boostMultiplier(current) - 1 : 0;
      const addMult = target ? boostMultiplier(target) - 1 : 0;
      for (const r of rec.recipients) {
        if (r.points <= 0) continue;
        const net = r.points * (addMult - removeMult);
        if (net === 0) continue;
        await tx.rewardLedger.create({
          data: {
            userId: r.userId,
            amount: net,
            type: "BOOST",
            sourceType: "recognition_boost",
            sourceId: rec.id,
            note: target
              ? `${BOOSTS[target].label} boost (${boostMultiplier(target)}×) by ${me.name}`
              : `${BOOSTS[current as BoostType].label} boost removed by ${me.name}`,
          },
        });
        await tx.user.update({
          where: { id: r.userId },
          data: { walletBalance: { increment: net } },
        });
      }

      // Commit the new boost state, but only if it hasn't changed since we read
      // it — otherwise a concurrent boost raced us and the whole tx rolls back.
      const updated = await tx.recognition.updateMany({
        where: { id: rec.id, boostType: current },
        data: {
          boostType: target,
          boostById: target ? me.id : null,
          boostAt: target ? new Date() : null,
        },
      });
      if (updated.count !== 1) {
        throw new BoostError("That recognition just changed — try again.");
      }
    });
  } catch (error) {
    if (error instanceof BoostError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/profile/[id]", "page");
  return { ok: true };
}
