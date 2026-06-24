import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { relativeTime, fullTimestamp } from "@/lib/datetime";

export type ReactionSummary = { emoji: string; count: number; reacted: boolean };

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
  reactions: { select: { emoji: true, userId: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
} as const;

type RawRecognition = Prisma.RecognitionGetPayload<{
  include: typeof feedInclude;
}>;

export function toFeedCard(r: RawRecognition, viewerId: string): FeedCard {
  const grouped = new Map<string, { count: number; reacted: boolean }>();
  for (const reaction of r.reactions) {
    const g = grouped.get(reaction.emoji) ?? { count: 0, reacted: false };
    g.count += 1;
    if (reaction.userId === viewerId) g.reacted = true;
    grouped.set(reaction.emoji, g);
  }

  return {
    id: r.id,
    message: r.message,
    imageUrls: r.imageUrls,
    system: r.system,
    visibility: r.visibility,
    createdAtLabel: relativeTime(r.createdAt),
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
    })),
    comments: r.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAtLabel: relativeTime(c.createdAt),
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
