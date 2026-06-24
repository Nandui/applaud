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
import { toggleReaction, addComment } from "@/lib/recognition/actions";
import { REACTION_EMOJIS } from "@/lib/config";
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

type Viewer = { id: string; name: string; avatarUrl?: string | null };

/** How many comments to show before the "View all" toggle. */
const COMMENT_PREVIEW = 2;

/** Apply a viewer reaction toggle to a reactions list (optimistic + pure). */
function toggleEmoji(
  state: FeedCard["reactions"],
  emoji: string,
): FeedCard["reactions"] {
  const existing = state.find((r) => r.emoji === emoji);
  if (!existing) return [...state, { emoji, count: 1, reacted: true }];
  if (existing.reacted) {
    const count = existing.count - 1;
    return count <= 0
      ? state.filter((r) => r.emoji !== emoji)
      : state.map((r) =>
          r.emoji === emoji ? { ...r, count, reacted: false } : r,
        );
  }
  return state.map((r) =>
    r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r,
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-secondary flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
        active ? "text-primary" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
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
  const [body, setBody] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Optimistic state so claps and comments land instantly, then reconcile with
  // the server's revalidated data — the snappy feel of a social app.
  const [reactions, applyReaction] = useOptimistic(card.reactions, toggleEmoji);
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

  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);
  const distinctEmojis = reactions.map((r) => r.emoji).slice(0, 3);
  const viewerClapped =
    reactions.find((r) => r.emoji === "👏")?.reacted ?? false;
  const viewerReacted = reactions.some((r) => r.reacted);

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
                  +{pts(card.pointsEach)}
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

        {/* Reactions + comment count summary */}
        {(totalReactions > 0 || comments.length > 0) && (
          <div className="text-muted flex items-center justify-between px-4 pt-3 text-xs">
            {totalReactions > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="flex -space-x-1">
                  {distinctEmojis.map((e) => (
                    <span
                      key={e}
                      className="bg-background ring-card flex size-5 items-center justify-center rounded-full text-[0.7rem] ring-2"
                    >
                      {e}
                    </span>
                  ))}
                </span>
                <span data-numeric>{totalReactions}</span>
              </span>
            ) : (
              <span />
            )}
            {comments.length > 0 && (
              <span>
                {comments.length}{" "}
                {comments.length === 1 ? "comment" : "comments"}
              </span>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="border-border mx-4 mt-2 grid grid-cols-3 border-t pt-1">
          <ActionButton onClick={() => react("👏")} active={viewerClapped}>
            <span className="text-base leading-none">👏</span> Clap
          </ActionButton>
          <ActionButton onClick={() => commentInputRef.current?.focus()}>
            <MessageCircle className="size-4" /> Comment
          </ActionButton>
          <Popover>
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
              <div className="flex gap-1">
                {REACTION_EMOJIS.map((emoji) => {
                  const active = reactions.find(
                    (r) => r.emoji === emoji,
                  )?.reacted;
                  return (
                    <button
                      key={emoji}
                      onClick={() => react(emoji)}
                      className={cn(
                        "hover:bg-secondary rounded-md p-1.5 text-lg transition-colors",
                        active && "bg-primary/10",
                      )}
                    >
                      {emoji}
                    </button>
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
