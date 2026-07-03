"use client";

import {
  Fragment,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Lock, Globe, MessageCircle, SmilePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { toggleReaction, addComment, toggleBoost } from "@/lib/recognition/actions";
import {
  REACTION_EMOJIS,
  BOOSTS,
  boostForRole,
  boostMultiplier,
  type BoostType,
} from "@/lib/config";
import type { FeedCard } from "@/lib/recognition/queries";
import { UserAvatar } from "@/components/user-avatar";
import { ValueChip } from "@/components/value-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
};

/** How many comments to show before the "View all" toggle. */
const COMMENT_PREVIEW = 2;

/** Fixed display order for reaction chips so reacting never reshuffles them. */
function reactionRank(emoji: string): number {
  const i = (REACTION_EMOJIS as readonly string[]).indexOf(emoji);
  return i === -1 ? REACTION_EMOJIS.length : i;
}

/**
 * Optimistically set the viewer's single reaction (one per person): the same
 * emoji toggles off, a different one switches. Keeps per-emoji counts and the
 * reactor lists in sync so the hover/click list updates instantly too.
 */
function switchReaction(
  state: FeedCard["reactions"],
  emoji: string,
  viewer: Viewer,
): FeedCard["reactions"] {
  const me = { id: viewer.id, name: viewer.name, avatarUrl: viewer.avatarUrl ?? null };
  const current = state.find((r) => r.reacted)?.emoji ?? null;

  const dropMine = (list: FeedCard["reactions"], target: string) =>
    list
      .map((r) =>
        r.emoji === target
          ? {
              ...r,
              count: r.count - 1,
              reacted: false,
              users: r.users.filter((u) => u.id !== viewer.id),
            }
          : r,
      )
      .filter((r) => r.count > 0);

  // Toggle my current reaction off.
  if (current === emoji) return dropMine(state, emoji);

  // Otherwise switch: remove my old reaction (if any), then add the new one.
  const without = current ? dropMine(state, current) : [...state];
  return without.some((r) => r.emoji === emoji)
    ? without.map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.count + 1, reacted: true, users: [...r.users, me] }
          : r,
      )
    : [...without, { emoji, count: 1, reacted: true, users: [me] }];
}

/**
 * A single reaction pill: shows the emoji + count, highlights when the viewer
 * reacted, previews reactor names on hover (native title), and opens the full
 * list on click.
 */
function ReactionChip({
  reaction,
}: {
  reaction: FeedCard["reactions"][number];
}) {
  const names = reaction.users.map((u) => u.name);
  const preview =
    names.slice(0, 10).join(", ") +
    (names.length > 10 ? ` and ${names.length - 10} more` : "");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          whileTap={{ scale: 0.9 }}
          title={preview}
          aria-label={`${reaction.count} reacted ${reaction.emoji}. See who.`}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors",
            reaction.reacted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border hover:bg-secondary",
          )}
        >
          <span className="text-base leading-none">{reaction.emoji}</span>
          <span data-numeric className="text-xs font-semibold">
            {reaction.count}
          </span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="text-muted flex items-center gap-1.5 border-b px-3 py-2 text-xs font-semibold">
          <span className="text-base leading-none">{reaction.emoji}</span>
          <span>
            <span data-numeric>{reaction.count}</span>{" "}
            {reaction.count === 1 ? "reaction" : "reactions"}
          </span>
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {reaction.users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/profile/${u.id}`}
                className="hover:bg-secondary flex items-center gap-2 px-3 py-1.5"
              >
                <UserAvatar
                  name={u.name}
                  avatarUrl={u.avatarUrl}
                  className="size-6"
                />
                <span className="truncate text-sm">{u.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function RecipientNames({
  recipients,
}: {
  recipients: FeedCard["recipients"];
}) {
  return (
    <>
      {recipients.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && (
            <span className="text-muted font-normal">
              {i === recipients.length - 1 ? " and " : ", "}
            </span>
          )}
          <Link
            href={`/profile/${r.id}`}
            className="font-semibold hover:underline"
          >
            {r.name}
          </Link>
        </Fragment>
      ))}
    </>
  );
}

/** One evenly-spaced action in the Facebook/Instagram-style action bar. */
function ActionButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "hover:bg-secondary flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
        active ? "text-primary" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

export function RecognitionCard({
  card,
  viewer,
  index = 0,
}: {
  card: FeedCard;
  viewer: Viewer;
  index?: number;
}) {
  const [, startReaction] = useTransition();
  const [, startComment] = useTransition();
  const [boostPending, startBoost] = useTransition();
  const [body, setBody] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Optimistic state so claps and comments land instantly, then reconcile with
  // the server's revalidated data — the snappy feel of a social app.
  const [reactions, applyReaction] = useOptimistic(
    card.reactions,
    (state: FeedCard["reactions"], emoji: string) =>
      switchReaction(state, emoji, viewer),
  );
  const [comments, addOptimisticComment] = useOptimistic(
    card.comments,
    (state: FeedCard["comments"], text: string) => [
      ...state,
      {
        id: `optimistic-${state.length}`,
        body: text,
        createdAtLabel: "Just now",
        user: {
          id: viewer.id,
          name: viewer.name,
          avatarUrl: viewer.avatarUrl ?? null,
        },
      },
    ],
  );

  function react(emoji: string) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("emoji", emoji);
    startReaction(async () => {
      applyReaction(emoji);
      await toggleReaction(fd);
    });
  }

  function pickReaction(emoji: string) {
    react(emoji);
    setReactOpen(false);
  }

  function onBoost(type: BoostType) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("type", type);
    startBoost(async () => {
      const res = await toggleBoost(fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  function replyTo(name: string) {
    setBody((b) => (b.trim() ? b : `@${name} `));
    commentInputRef.current?.focus();
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("body", value);
    setBody("");
    startComment(async () => {
      addOptimisticComment(value);
      await addComment(fd);
    });
  }

  const viewerReacted = reactions.some((r) => r.reacted);

  // Point-multiplier boost display + the current viewer's ability to change it.
  const activeType =
    card.boostType && card.boostType in BOOSTS
      ? (card.boostType as BoostType)
      : null;
  const activeBoost = activeType ? BOOSTS[activeType] : null;
  const effectivePoints = activeBoost
    ? card.pointsEach * activeBoost.multiplier
    : card.pointsEach;

  const myBoostType = boostForRole(viewer.role);
  // What the viewer can do: remove their own boost, apply onto an unboosted or
  // lower-boosted post, or nothing (a higher boost is already applied).
  let boostMode: "apply" | "remove" | null = null;
  if (myBoostType && card.pointsEach > 0) {
    if (activeType === myBoostType) boostMode = "remove";
    else if (
      activeType === null ||
      boostMultiplier(myBoostType) > boostMultiplier(activeType)
    )
      boostMode = "apply";
  }

  const hiddenCount =
    !showAllComments && comments.length > COMMENT_PREVIEW
      ? comments.length - COMMENT_PREVIEW
      : 0;
  const visibleComments = hiddenCount
    ? comments.slice(-COMMENT_PREVIEW)
    : comments;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
    >
      <div
        className={cn(
          "bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm",
          card.system && "border-accent/40 bg-accent/[0.03]",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {card.system ? (
            <UserAvatar
              name={card.sender.name}
              avatarUrl={card.sender.avatarUrl}
              className="size-10"
            />
          ) : (
            <Link href={`/profile/${card.sender.id}`} className="shrink-0">
              <UserAvatar
                name={card.sender.name}
                avatarUrl={card.sender.avatarUrl}
                className="size-10"
              />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              {card.system ? (
                <span className="text-accent inline-flex items-center gap-1 font-semibold">
                  <Sparkles className="size-3.5" /> {card.sender.name}
                </span>
              ) : (
                <Link
                  href={`/profile/${card.sender.id}`}
                  className="font-semibold hover:underline"
                >
                  {card.sender.name}
                </Link>
              )}{" "}
              <span className="text-muted font-normal">recognised</span>{" "}
              <RecipientNames recipients={card.recipients} />
            </p>
            <p className="text-muted mt-0.5 flex items-center gap-1 text-xs">
              <time title={card.createdAtFull}>{card.createdAtLabel}</time>
              <span aria-hidden>·</span>
              {card.visibility === "private" ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" /> Private
                </span>
              ) : (
                <Globe className="size-3" aria-label="Public" />
              )}
            </p>
          </div>
          {(card.value || card.pointsEach > 0) && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {card.value && <ValueChip value={card.value} />}
              {card.pointsEach > 0 && (
                <span
                  data-numeric
                  className="text-success bg-success/10 rounded-full px-2 py-0.5 text-xs font-semibold"
                >
                  +{pts(effectivePoints)}
                </span>
              )}
              {activeBoost && (
                <span className="bg-accent/15 text-accent inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                  <span aria-hidden>{activeBoost.emoji}</span>
                  {activeBoost.label} ·{" "}
                  <span data-numeric>{activeBoost.multiplier}×</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Message */}
        {card.message && (
          <p className="text-foreground px-4 pb-3 text-[0.95rem] leading-relaxed whitespace-pre-line">
            {card.message}
          </p>
        )}

        {/* Photos / GIFs — edge to edge, Instagram-style */}
        {card.imageUrls.length > 0 && (
          <div
            className={cn(
              "grid gap-0.5",
              card.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {card.imageUrls.map((url, i) => {
              const count = card.imageUrls.length;
              const wide = count === 3 && i === 2;
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "bg-secondary block overflow-hidden",
                    wide && "col-span-2",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Recognition attachment ${i + 1} of ${count}`}
                    loading="lazy"
                    className={cn(
                      "w-full",
                      count === 1
                        ? "max-h-[32rem] object-contain"
                        : wide
                          ? "aspect-[2/1] object-cover"
                          : "aspect-square object-cover",
                    )}
                  />
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions — prominent chips; hover previews who, click opens the list */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
            {[...reactions]
              .sort((a, b) => reactionRank(a.emoji) - reactionRank(b.emoji))
              .map((r) => (
                <ReactionChip key={r.emoji} reaction={r} />
              ))}
          </div>
        )}

        {comments.length > 0 && (
          <div className="text-muted px-4 pt-2 text-xs">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </div>
        )}

        {/* Boost control — shown only to a role that can change this post's boost */}
        {boostMode && myBoostType && (
          <div className="px-4 pt-2">
            <button
              type="button"
              onClick={() => onBoost(myBoostType)}
              disabled={boostPending}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                boostMode === "remove"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-foreground hover:bg-secondary",
              )}
            >
              <span aria-hidden>{BOOSTS[myBoostType].emoji}</span>
              {boostMode === "remove"
                ? `Remove ${BOOSTS[myBoostType].label} boost`
                : `Apply ${BOOSTS[myBoostType].label} boost · ${BOOSTS[myBoostType].multiplier}×`}
            </button>
          </div>
        )}

        {/* Action bar */}
        <div className="border-border mx-4 mt-2 grid grid-cols-2 border-t pt-1">
          <ActionButton onClick={() => commentInputRef.current?.focus()}>
            <MessageCircle className="size-4" /> Comment
          </ActionButton>
          <Popover open={reactOpen} onOpenChange={setReactOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "hover:bg-secondary flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
                  viewerReacted
                    ? "text-primary"
                    : "text-muted hover:text-foreground",
                )}
              >
                <SmilePlus className="size-4" /> React
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1.5" align="center">
              <div className="flex gap-0.5">
                {REACTION_EMOJIS.map((emoji) => {
                  const active = reactions.find(
                    (r) => r.emoji === emoji,
                  )?.reacted;
                  return (
                    <motion.button
                      key={emoji}
                      type="button"
                      onClick={() => pickReaction(emoji)}
                      whileHover={{ scale: 1.3, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`React ${emoji}`}
                      className={cn(
                        "rounded-lg p-1.5 text-2xl leading-none transition-colors",
                        active ? "bg-primary/10" : "hover:bg-secondary",
                      )}
                    >
                      {emoji}
                    </motion.button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Comments — Facebook-style bubbles */}
        {comments.length > 0 && (
          <div className="space-y-2.5 px-4 pt-3">
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllComments(true)}
                className="text-muted hover:text-foreground text-xs font-semibold"
              >
                View {hiddenCount} more {hiddenCount === 1 ? "comment" : "comments"}
              </button>
            )}
            {visibleComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Link href={`/profile/${c.user.id}`} className="mt-0.5 shrink-0">
                  <UserAvatar
                    name={c.user.name}
                    avatarUrl={c.user.avatarUrl}
                    className="size-8"
                  />
                </Link>
                <div className="min-w-0">
                  <div className="bg-secondary w-fit max-w-full rounded-2xl px-3 py-2">
                    <Link
                      href={`/profile/${c.user.id}`}
                      className="block text-xs font-semibold hover:underline"
                    >
                      {c.user.name}
                    </Link>
                    <p className="text-foreground/90 text-sm leading-snug break-words whitespace-pre-line">
                      {c.body}
                    </p>
                  </div>
                  <div className="text-muted mt-1 flex items-center gap-3 px-3 text-xs font-semibold">
                    <span>{c.createdAtLabel}</span>
                    <button
                      type="button"
                      onClick={() => replyTo(c.user.name)}
                      className="hover:text-foreground"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={submitComment}
          className="flex items-center gap-2 px-4 pt-3 pb-4"
        >
          <UserAvatar
            name={viewer.name}
            avatarUrl={viewer.avatarUrl}
            className="size-8 shrink-0"
          />
          <div className="bg-secondary focus-within:ring-primary/30 flex flex-1 items-center rounded-full focus-within:ring-2">
            <input
              ref={commentInputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Comment as ${viewer.name}`}
              maxLength={500}
              className="placeholder:text-muted h-9 min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!body.trim()}
              aria-label="Post comment"
              className="text-primary disabled:text-muted/40 mr-1 flex size-8 shrink-0 items-center justify-center transition-colors"
            >
              <Send className="size-4.5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
