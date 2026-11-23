import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatDistanceStrict } from "date-fns";
import { shortTime, fullTimestamp } from "@/lib/datetime";
import { AUTHORED_KINDS } from "@/lib/posts/kinds";
import { lookOf } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import type { Cosmetic, FrameArt, Look } from "@/lib/cosmetics";
import {
  summarizeCommentReactions,
  type CommentReactionSummary,
} from "@/lib/recognition/comment-reactions";

export type ReactionUser = { id: string; name: string; avatarUrl: string | null; frame: FrameArt | null };
export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
  users: ReactionUser[];
};

export type FeedCardComment = {
  id: string;
  body: string;
  /** A GIPHY GIF sent with (or instead of) the text. */
  gifUrl: string | null;
  /** The top-level comment this one replies to, or null for a top-level comment. */
  parentId: string | null;
  createdAtLabel: string;
  user: { id: string; name: string; avatarUrl: string | null; frame: FrameArt | null };
  reactions: CommentReactionSummary[];
};

/** What the feed loads for each comment. */
export const commentInclude = {
  user: { select: { id: true, name: true, avatarUrl: true, profile: true } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

type RawComment = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export function toFeedComment(c: RawComment, viewerId: string, catalogue: Cosmetic[]): FeedCardComment {
  return {
    id: c.id,
    body: c.body,
    gifUrl: c.gifUrl,
    parentId: c.parentId,
    createdAtLabel: shortTime(c.createdAt),
    user: {
      id: c.user.id,
      name: c.user.name,
      avatarUrl: c.user.avatarUrl,
      frame: lookOf(c.user.profile, catalogue).frame,
    },
    reactions: summarizeCommentReactions(c.reactions, viewerId),
  };
}

/** Someone's shop look, so the feed can show the frames and banners they bought. */
export type { Look };

/**
 * A poll, shaped for one viewer. Per-choice counts are only sent when this
 * viewer may see them: the person who asked always can; voters can once they
 * have voted (or the poll has closed) unless the asker kept results to
 * themselves. Votes are anonymous, so no names are ever sent.
 */
export type FeedPoll = {
  options: { id: string; label: string; votes: number | null }[];
  totalVotes: number;
  myOptionId: string | null;
  closed: boolean;
  /** "2 days left", "Ended 3h ago", or null when it never closes. */
  closesLabel: string | null;
  resultsVisible: boolean;
  /** The asker's setting: voters see results after voting. */
  showResultsToVoters: boolean;
};

/**
 * A question, shaped for one viewer. Answers are private: the viewer only
 * ever gets their own; the asker reads everyone's with getQuestionAnswers.
 */
export type FeedQuestion = {
  answerCount: number;
  myAnswer: string | null;
};

export type FeedCard = {
  id: string;
  /**
   * "recognition" (a shout-out), "post" (an ordinary post by the sender),
   * "poll" or "question" (asked by the sender; message is the question).
   */
  kind: "recognition" | "post" | "poll" | "question";
  message: string;
  imageUrls: string[];
  boostType: string | null;
  system: boolean;
  createdAtLabel: string;
  createdAtFull: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
    jobTitle: string | null;
    look: Look;
  };
  value: { name: string; icon: string | null; color: string | null; imageUrl: string | null } | null;
  recipients: {
    id: string;
    name: string;
    avatarUrl: string | null;
    points: number;
    look: Look;
  }[];
  pointsEach: number;
  reactions: ReactionSummary[];
  comments: FeedCardComment[];
  poll: FeedPoll | null;
  question: FeedQuestion | null;
};

/**
 * What the feed loads per row. Takes the viewer because poll votes and
 * question answers are only loaded for them (counts for everyone else).
 */
const feedInclude = (viewerId: string) => ({
  sender: { select: { id: true, name: true, avatarUrl: true, jobTitle: true, profile: true } },
  value: { select: { name: true, icon: true, color: true, imageUrl: true } },
  recipients: {
    include: { user: { select: { id: true, name: true, avatarUrl: true, profile: true } } },
  },
  reactions: {
    select: {
      emoji: true,
      userId: true,
      user: { select: { id: true, name: true, avatarUrl: true, profile: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: commentInclude,
  },
  pollOptions: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, label: true, _count: { select: { votes: true } } },
  },
  pollVotes: { where: { userId: viewerId }, select: { optionId: true } },
  answers: { where: { userId: viewerId }, select: { body: true } },
  _count: { select: { pollVotes: true, answers: true } },
}) satisfies Prisma.RecognitionInclude;

type RawRecognition = Prisma.RecognitionGetPayload<{
  include: ReturnType<typeof feedInclude>;
}>;

const KINDS = ["recognition", "post", "poll", "question"] as const;

function toFeedPoll(r: RawRecognition, viewerId: string, now: Date): FeedPoll {
  const myOptionId = r.pollVotes[0]?.optionId ?? null;
  const closed = r.pollClosesAt !== null && r.pollClosesAt <= now;
  const isAsker = r.senderId === viewerId;
  const resultsVisible = isAsker || (r.pollShowResults && (myOptionId !== null || closed));
  return {
    options: r.pollOptions.map((o) => ({
      id: o.id,
      label: o.label,
      votes: resultsVisible ? o._count.votes : null,
    })),
    totalVotes: r._count.pollVotes,
    myOptionId,
    closed,
    closesLabel: r.pollClosesAt
      ? closed
        ? `Ended ${formatDistanceStrict(r.pollClosesAt, now)} ago`
        : `${formatDistanceStrict(r.pollClosesAt, now)} left`
      : null,
    resultsVisible,
    showResultsToVoters: r.pollShowResults,
  };
}

export function toFeedCard(r: RawRecognition, viewerId: string, catalogue: Cosmetic[]): FeedCard {
  const kind = (KINDS as readonly string[]).includes(r.kind) ? (r.kind as FeedCard["kind"]) : "recognition";
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
      frame: lookOf(reaction.user.profile, catalogue).frame,
    });
    grouped.set(reaction.emoji, g);
  }

  return {
    id: r.id,
    kind,
    message: r.message,
    imageUrls: r.imageUrls,
    boostType: r.boostType,
    system: r.system,
    createdAtLabel: shortTime(r.createdAt),
    createdAtFull: fullTimestamp(r.createdAt),
    sender: {
      id: r.sender.id,
      name: r.sender.name,
      avatarUrl: r.sender.avatarUrl,
      jobTitle: r.sender.jobTitle,
      look: lookOf(r.sender.profile, catalogue),
    },
    value: r.value
      ? { name: r.value.name, icon: r.value.icon, color: r.value.color, imageUrl: r.value.imageUrl }
      : null,
    recipients: r.recipients.map((rr) => ({
      id: rr.user.id,
      name: rr.user.name,
      avatarUrl: rr.user.avatarUrl,
      points: rr.points,
      look: lookOf(rr.user.profile, catalogue),
    })),
    pointsEach: r.recipients[0]?.points ?? 0,
    reactions: [...grouped.entries()].map(([emoji, g]) => ({
      emoji,
      count: g.count,
      reacted: g.reacted,
      users: g.users,
    })),
    // Questions never show public comments: answers are private.
    comments: kind === "question" ? [] : r.comments.map((c) => toFeedComment(c, viewerId, catalogue)),
    poll: kind === "poll" ? toFeedPoll(r, viewerId, new Date()) : null,
    question:
      kind === "question"
        ? { answerCount: r._count.answers, myAnswer: r.answers[0]?.body ?? null }
        : null,
  };
}

/** Recognitions a given user has received. Every recognition is public. */
export async function getReceivedCards(
  userId: string,
  viewerId: string,
  take = 20,
): Promise<FeedCard[]> {
  const catalogue = await getCatalogue();
  const rows = await prisma.recognition.findMany({
    where: {
      recipients: { some: { userId } },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude(viewerId),
  });
  return rows.map((r) => toFeedCard(r, viewerId, catalogue));
}

/** Recognitions a user has sent (non-system). Every recognition is public. */
export async function getGivenCards(
  userId: string,
  viewerId: string,
  take = 20,
): Promise<FeedCard[]> {
  const catalogue = await getCatalogue();
  const rows = await prisma.recognition.findMany({
    where: {
      senderId: userId,
      system: false,
      kind: "recognition",
    },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude(viewerId),
  });
  return rows.map((r) => toFeedCard(r, viewerId, catalogue));
}

/** Posts, polls and questions a user has written, newest first (always public). */
export async function getPostCards(
  userId: string,
  viewerId: string,
  take = 20,
): Promise<FeedCard[]> {
  const catalogue = await getCatalogue();
  const rows = await prisma.recognition.findMany({
    where: { senderId: userId, kind: { in: [...AUTHORED_KINDS] } },
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude(viewerId),
  });
  return rows.map((r) => toFeedCard(r, viewerId, catalogue));
}

/**
 * Specific recognitions by id (a profile's pinned shout-outs), in the given
 * order, dropping any that no longer exist.
 */
export async function getCardsByIds(ids: string[], viewerId: string): Promise<FeedCard[]> {
  if (ids.length === 0) return [];
  const catalogue = await getCatalogue();
  const rows = await prisma.recognition.findMany({
    where: {
      id: { in: ids },
    },
    include: feedInclude(viewerId),
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is RawRecognition => Boolean(r))
    .map((r) => toFeedCard(r, viewerId, catalogue));
}

/** The feed: every recognition and post, newest first. All of them are public. */
export async function getFeedCards(viewerId: string, take = 40): Promise<FeedCard[]> {
  const catalogue = await getCatalogue();
  const rows = await prisma.recognition.findMany({
    where: {},
    orderBy: { createdAt: "desc" },
    take,
    include: feedInclude(viewerId),
  });
  return rows.map((r) => toFeedCard(r, viewerId, catalogue));
}
