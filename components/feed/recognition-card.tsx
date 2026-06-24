"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Lock, Globe, MessageCircle, SmilePlus } from "lucide-react";
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

/** How many comments to show before the "View all" toggle. */
const COMMENT_PREVIEW = 2;

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
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hover:bg-secondary flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50",
        active ? "text-primary" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function RecognitionCard({
  card,
  index = 0,
}: {
  card: FeedCard;
  index?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [commentPending, startComment] = useTransition();
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  function react(emoji: string) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("emoji", emoji);
    startTransition(() => {
      void toggleReaction(fd);
    });
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("body", value);
    startComment(async () => {
      const res = await addComment(fd);
      if (res.ok) setBody("");
    });
  }

  const totalReactions = card.reactions.reduce((sum, r) => sum + r.count, 0);
  const distinctEmojis = card.reactions.map((r) => r.emoji).slice(0, 3);
  const viewerClapped =
    card.reactions.find((r) => r.emoji === "👏")?.reacted ?? false;
  const viewerReacted = card.reactions.some((r) => r.reacted);

  const hiddenCount =
    !showAllComments && card.comments.length > COMMENT_PREVIEW
      ? card.comments.length - COMMENT_PREVIEW
      : 0;
  const visibleComments = hiddenCount
    ? card.comments.slice(-COMMENT_PREVIEW)
    : card.comments;

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
              // A lone third tile spans the full width instead of sitting
              // orphaned beside an empty cell.
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
        {(totalReactions > 0 || card.comments.length > 0) && (
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
            {card.comments.length > 0 && (
              <span>
                {card.comments.length}{" "}
                {card.comments.length === 1 ? "comment" : "comments"}
              </span>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="border-border mx-4 mt-2 grid grid-cols-3 border-t pt-1">
          <ActionButton
            onClick={() => react("👏")}
            active={viewerClapped}
            disabled={pending}
          >
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
                  viewerReacted ? "text-primary" : "text-muted hover:text-foreground",
                )}
              >
                <SmilePlus className="size-4" /> React
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1.5" align="center">
              <div className="flex gap-1">
                {REACTION_EMOJIS.map((emoji) => {
                  const active = card.reactions.find(
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

        {/* Comments */}
        {card.comments.length > 0 && (
          <div className="space-y-3 px-4 pt-3">
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllComments(true)}
                className="text-muted hover:text-foreground text-xs font-medium"
              >
                View all {card.comments.length} comments
              </button>
            )}
            {visibleComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Link href={`/profile/${c.user.id}`} className="shrink-0">
                  <UserAvatar
                    name={c.user.name}
                    avatarUrl={c.user.avatarUrl}
                    className="size-7"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <Link
                      href={`/profile/${c.user.id}`}
                      className="font-semibold hover:underline"
                    >
                      {c.user.name}
                    </Link>{" "}
                    <span className="text-foreground/90">{c.body}</span>
                  </p>
                  <span className="text-muted text-xs">{c.createdAtLabel}</span>
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
          <input
            ref={commentInputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="bg-secondary placeholder:text-muted focus:ring-primary/30 h-9 flex-1 rounded-full border-0 px-4 text-sm outline-none focus:ring-2"
          />
          <button
            type="submit"
            disabled={commentPending || !body.trim()}
            className="text-primary px-1 text-sm font-semibold disabled:opacity-40"
          >
            Post
          </button>
        </form>
      </div>
    </motion.div>
  );
}
