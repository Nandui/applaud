/**
 * Emoji reactions on comments, and how comments group into threads. Pure
 * helpers shared by the server (feed queries, the live poll) and the card.
 */
import { REACTION_EMOJIS } from "@/lib/config";

export type CommentReactionSummary = { emoji: string; count: number; reacted: boolean };

/** Fixed display order so reacting never reshuffles a comment's chips. */
function rank(emoji: string): number {
  const i = (REACTION_EMOJIS as readonly string[]).indexOf(emoji);
  return i === -1 ? REACTION_EMOJIS.length : i;
}

function sorted(list: CommentReactionSummary[]): CommentReactionSummary[] {
  return [...list].sort((a, b) => rank(a.emoji) - rank(b.emoji));
}

/** Group raw reaction rows into one chip per emoji. */
export function summarizeCommentReactions(
  rows: { emoji: string; userId: string }[],
  viewerId: string,
): CommentReactionSummary[] {
  const byEmoji = new Map<string, CommentReactionSummary>();
  for (const row of rows) {
    const s = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, reacted: false };
    s.count += 1;
    if (row.userId === viewerId) s.reacted = true;
    byEmoji.set(row.emoji, s);
  }
  return sorted([...byEmoji.values()]);
}

/** Group every reaction on a post's comments by comment. */
export function reactionsByComment(
  rows: { commentId: string; emoji: string; userId: string }[],
  viewerId: string,
): Record<string, CommentReactionSummary[]> {
  const grouped = new Map<string, { emoji: string; userId: string }[]>();
  for (const row of rows) {
    const list = grouped.get(row.commentId) ?? [];
    list.push(row);
    grouped.set(row.commentId, list);
  }
  const out: Record<string, CommentReactionSummary[]> = {};
  for (const [commentId, list] of grouped) out[commentId] = summarizeCommentReactions(list, viewerId);
  return out;
}

/** The viewer's own reaction on a comment, if any. */
export function myCommentReaction(list: CommentReactionSummary[]): string | null {
  return list.find((r) => r.reacted)?.emoji ?? null;
}

/**
 * The chips with the viewer's reaction replaced by `mine` (null takes it
 * away), for showing a tap straight away before the server has it.
 */
export function withMyReaction(
  list: CommentReactionSummary[],
  mine: string | null,
): CommentReactionSummary[] {
  const out = list
    .map((r) => (r.reacted ? { ...r, count: r.count - 1, reacted: false } : r))
    .filter((r) => r.count > 0);
  if (mine) {
    const i = out.findIndex((r) => r.emoji === mine);
    if (i === -1) out.push({ emoji: mine, count: 1, reacted: true });
    else out[i] = { ...out[i], count: out[i].count + 1, reacted: true };
  }
  return sorted(out);
}

/** What tapping `emoji` does: the same emoji takes it back, another switches. */
export function nextCommentReaction(list: CommentReactionSummary[], emoji: string): string | null {
  return myCommentReaction(list) === emoji ? null : emoji;
}

/**
 * Top-level comments in order, each with its replies in order. A reply whose
 * comment isn't in the list (not loaded yet) is shown as top-level so it is
 * never lost.
 */
export function threadComments<T extends { id: string; parentId: string | null }>(
  comments: T[],
): { comment: T; replies: T[] }[] {
  const ids = new Set(comments.map((c) => c.id));
  const threads: { comment: T; replies: T[] }[] = [];
  const byId = new Map<string, { comment: T; replies: T[] }>();
  for (const c of comments) {
    if (c.parentId && ids.has(c.parentId)) continue;
    const t = { comment: c, replies: [] as T[] };
    threads.push(t);
    byId.set(c.id, t);
  }
  for (const c of comments) {
    if (c.parentId && ids.has(c.parentId)) byId.get(c.parentId)?.replies.push(c);
  }
  return threads;
}

/** How the comments sheet orders top-level comments. */
export type CommentSort = "relevant" | "newest" | "all";

/**
 * Top-level comments in the chosen order. "relevant" puts the most reacted to
 * and replied to first (a reply counts double), ties in the order posted;
 * "newest" is newest first; "all" is the order they were posted. `threads`
 * must be in the order posted, as threadComments returns them.
 */
export function sortThreads<T extends { comment: { reactions: CommentReactionSummary[] }; replies: unknown[] }>(
  threads: T[],
  sort: CommentSort,
  reactionsOf: (comment: T["comment"]) => CommentReactionSummary[] = (c) => c.reactions,
): T[] {
  if (sort === "all") return [...threads];
  if (sort === "newest") return [...threads].reverse();
  const score = (t: T) =>
    reactionsOf(t.comment).reduce((sum, r) => sum + r.count, 0) + 2 * t.replies.length;
  return threads
    .map((t, i) => ({ t, i, s: score(t) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ t }) => t);
}
