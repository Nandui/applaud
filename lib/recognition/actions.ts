"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { allowanceForRole, getMonthlyAllowanceUsage } from "@/lib/points";
import { REACTION_EMOJIS } from "@/lib/config";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

class AllowanceError extends Error {}

const createSchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1, "Pick at least one recipient.").max(10),
  valueId: z.string().min(1, "Choose a value."),
  message: z.string().trim().min(3, "Write a short message.").max(500),
  points: z.coerce.number().int().min(0).max(100_000),
  visibility: z.enum(["public", "private"]).default("public"),
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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { valueId, message, points, visibility } = parsed.data;
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

/** Add or remove the current user's reaction (toggle). */
export async function toggleReaction(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = reactionSchema.safeParse({
    recognitionId: formData.get("recognitionId"),
    emoji: formData.get("emoji"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid reaction." };
  const { recognitionId, emoji } = parsed.data;

  const existing = await prisma.reaction.findUnique({
    where: { recognitionId_userId_emoji: { recognitionId, userId: me.id, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { recognitionId, userId: me.id, emoji },
    });
  }
  revalidatePath("/");
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
  return { ok: true };
}
