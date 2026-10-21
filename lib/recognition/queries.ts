import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { shortTime, fullTimestamp } from "@/lib/datetime";

export type ReactionUser = { id: string; name: string; avatarUrl: string | null };
export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
  users: ReactionUser[];
};

export type FeedCardComment = {
  id: string;
  body: string;
  createdAtLabel: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type FeedCard = {
  id: string;
  message: string;
  imageUrls: string[];
  boostType: string | null;
  system: boolean;
  visibility: string;
  createdAtLabel: string;
  createdAtFull: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
    jobTitle: string | null;
  };
  value: { name: string; icon: string | null; color: string | null } | null;
  recipients: {
    id: string;
    name: string;
    avatarUrl: string | null;
    points: number;
  }[];
  pointsEach: number;
  reactions: ReactionSummary[];
  comments: FeedCardComment[];
};

const feedInclude = {
  sender: { select: { id: true, name: true, avatarUrl: true, jobTitle: true } },
  value: { select: { name: true, icon: true, color: true } },
  recipients: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  reactions: {
    select: {
      emoji: true,
      userId: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
} as const;

type RawRecognition = Prisma.RecognitionGetPayload<{
  include: typeof feedInclude;
}>;

export function toFeedCard(r: RawRecognition, viewerId: string): FeedCard {
  const grouped = new Map<
    string,
    { count: number; reacted: boolean; users: ReactionUser[] }
  >();
  for (const reaction of r.reactions) {
    const g = grouped.get(reaction.emoji) ?? { count: 0, reacted: false, users: [] };
    g.count += 1;
    if (reaction.userId === viewerId) g.reacted = true;
    g.users.push({
      id: reaction.user.id,
      name: reaction.user.name,
      avatarUrl: reaction.user.avatarUrl,
    });
    grouped.set(reaction.emoji, g);
  }

  return {
    id: r.id,
    message: r.message,
    imageUrls: r.imageUrls,
    boostType: r.boostType,
    system: r.system,
    visibility: r.visibility,
    createdAtLabel: shortTime(r.createdAt),
    createdAtFull: fullTimestamp(r.createdAt),
    sender: {
      id: r.sender.id,
      name: r.sender.name,
      avatarUrl: r.sender.avatarUrl,
      jobTitle: r.sender.jobTitle,
    },
    value: r.value
      ? { name: r.value.name, icon: r.value.icon, color: r.value.color }
      : null,
    recipients: r.recipients.map((rr) => ({
      id: rr.user.id,
      name: rr.user.name,
      avatarUrl: rr.user.avatarUrl,
      points: rr.points,
    })),
    pointsEach: r.recipients[0]?.points ?? 0,
    reactions: [...grouped.entries()].map(([emoji, g]) => ({
      emoji,
      count: g.count,
      reacted: g.reacted,
      users: g.users,
    })),
    comments: r.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAtLabel: shortTime(c.createdAt),
      user: { id: c.user.id, name: c.user.name, avatarUrl: c.user.avatarUrl },
    })),
  };
}

/** Recognitions a given user has received, respecting the viewer's visibility. */
export async function getReceivedCards(
  userId: string,
  viewerId: string,
  take = 20,
): Promise<FeedCard[]> {
  const rows = await prisma.recognition.findMany({
    where: {
      recipients: { some: { userId } },
      OR: [
        { visibility: "public" },
        { senderId: viewerId },
        { recipients: { some: { userId: viewerId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude,
  });
  return rows.map((r) => toFeedCard(r, viewerId));
}

/** Recognitions a user has sent (non-system), respecting the viewer's visibility. */
export async function getGivenCards(
  userId: string,
  viewerId: string,
  take = 20,
): Promise<FeedCard[]> {
  const rows = await prisma.recognition.findMany({
    where: {
      senderId: userId,
      system: false,
      OR: [
        { visibility: "public" },
        { senderId: viewerId },
        { recipients: { some: { userId: viewerId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude,
  });
  return rows.map((r) => toFeedCard(r, viewerId));
}

/**
 * Specific recognitions by id (a profile's pinned shout-outs), in the given
 * order, dropping any the viewer isn't allowed to see.
 */
export async function getCardsByIds(ids: string[], viewerId: string): Promise<FeedCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.recognition.findMany({
    where: {
      id: { in: ids },
      OR: [
        { visibility: "public" },
        { senderId: viewerId },
        { recipients: { some: { userId: viewerId } } },
      ],
    },
    include: feedInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is RawRecognition => Boolean(r))
    .map((r) => toFeedCard(r, viewerId));
}

/** Feed visible to a viewer: public posts + their own sent/received private posts. */
export async function getFeedCards(viewerId: string, take = 40): Promise<FeedCard[]> {
  const rows = await prisma.recognition.findMany({
    where: {
      OR: [
        { visibility: "public" },
        { senderId: viewerId },
        { recipients: { some: { userId: viewerId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude,
  });
  return rows.map((r) => toFeedCard(r, viewerId));
}
