import { prisma } from "@/lib/prisma";
import { getCatalogue } from "@/lib/catalogue";
import { commentInclude, toFeedComment, type FeedCardComment } from "@/lib/recognition/queries";
import {
  reactionsByComment,
  type CommentReactionSummary,
} from "@/lib/recognition/comment-reactions";
import { TYPING_FRESH_MS, type TypingUser } from "@/lib/recognition/live-config";

/** Most comments one poll returns; the rest come on the next poll. */
const MAX_COMMENTS = 100;

/** Whether the viewer may see this post (same rule as the feed). */
export async function canSeeRecognition(recognitionId: string, viewerId: string) {
  const row = await prisma.recognition.findFirst({
    where: {
      id: recognitionId,
      OR: [
        { visibility: "public" },
        { senderId: viewerId },
        { recipients: { some: { userId: viewerId } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * Comments on a post newer than `afterId` (all of them when it is missing or
 * unknown), oldest first, shaped like the feed's comments.
 */
export async function commentsAfter(
  recognitionId: string,
  afterId: string | null,
  viewerId: string,
): Promise<FeedCardComment[]> {
  const after = afterId
    ? await prisma.comment.findFirst({
        where: { id: afterId, recognitionId },
        select: { createdAt: true },
      })
    : null;
  const [rows, catalogue] = await Promise.all([
    prisma.comment.findMany({
      where: { recognitionId, ...(after ? { createdAt: { gt: after.createdAt } } : {}) },
      orderBy: { createdAt: "asc" },
      take: MAX_COMMENTS,
      include: commentInclude,
    }),
    getCatalogue(),
  ]);
  return rows.map((c) => toFeedComment(c, viewerId, catalogue));
}

/**
 * Every reaction on every comment of a post, by comment id. Sent with each
 * poll while the comments are open, because people react to old comments too.
 */
export async function commentReactionsOn(
  recognitionId: string,
  viewerId: string,
): Promise<Record<string, CommentReactionSummary[]>> {
  const rows = await prisma.commentReaction.findMany({
    where: { comment: { recognitionId } },
    select: { commentId: true, emoji: true, userId: true },
  });
  return reactionsByComment(rows, viewerId);
}

/** Everyone but the viewer who is writing a comment on this post right now. */
export async function typingOn(recognitionId: string, viewerId: string): Promise<TypingUser[]> {
  const rows = await prisma.commentTyping.findMany({
    where: {
      recognitionId,
      userId: { not: viewerId },
      updatedAt: { gt: new Date(Date.now() - TYPING_FRESH_MS) },
    },
    orderBy: { updatedAt: "asc" },
    select: { userId: true },
  });
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) }, active: true },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => byId.get(r.userId) ?? []);
}

/** Mark the viewer as typing on a post, or no longer typing. */
export async function setTyping(recognitionId: string, userId: string, typing: boolean) {
  if (!typing) {
    await prisma.commentTyping.deleteMany({ where: { recognitionId, userId } });
    return;
  }
  const now = new Date();
  await prisma.commentTyping.upsert({
    where: { recognitionId_userId: { recognitionId, userId } },
    create: { recognitionId, userId, updatedAt: now },
    update: { updatedAt: now },
  });
  // Tidy up rows left by closed tabs; anything this old is long stale.
  await prisma.commentTyping.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
}
