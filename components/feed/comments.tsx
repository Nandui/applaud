"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, Send, SmilePlus, X } from "lucide-react";
import { toast } from "sonner";
import { addComment, toggleCommentReaction } from "@/lib/recognition/actions";
import { useLiveComments, TypingLine } from "@/components/feed/live-comments";
import { GifPicker } from "@/components/recognize/gif-picker";
import { REACTION_EMOJIS } from "@/lib/config";
import type { FeedCard, FeedCardComment } from "@/lib/recognition/queries";
import {
  myCommentReaction,
  nextCommentReaction,
  threadComments,
  withMyReaction,
  type CommentReactionSummary,
} from "@/lib/recognition/comment-reactions";
import { FramedAvatar } from "@/components/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** The viewer's equipped frame, for their own optimistic comments. */
  frame?: string | null;
};

/** The one-tap reaction on a comment, like the post's. */
const QUICK_EMOJI = "❤️";
/** Hold a comment's heart this long to pick another emoji. */
const LONG_PRESS_MS = 380;
/** Replies shown under a comment before "View N more replies". */
const REPLIES_SHOWN = 2;

const OPTIMISTIC = "optimistic-";
const isPending = (c: FeedCardComment) => c.id.startsWith(OPTIMISTIC);
const firstName = (name: string) => name.split(" ")[0] || name;

/**
 * Everything about one post's comments: the list (with replies), what is
 * live, the draft and who it replies to, sending, and reacting to comments.
 * The feed card shows a preview from it and hands it to <CommentsSheet>.
 */
export function useCardComments({
  card,
  viewer,
  open,
}: {
  card: FeedCard;
  viewer: Viewer;
  open: boolean;
}) {
  const [, startComment] = useTransition();
  const [body, setBody] = useState("");
  /** Replying to this thread (always a top-level comment), and to whom. */
  const [replyTo, setReplyTo] = useState<{ threadId: string; name: string } | null>(null);
  /** Threads opened past their first few replies. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const [shown, addOptimisticComment] = useOptimistic(
    card.comments,
    (
      state: FeedCard["comments"],
      sent: { body: string; gifUrl: string | null; parentId: string | null },
    ) => [
      ...state,
      {
        id: `${OPTIMISTIC}${state.length}`,
        body: sent.body,
        gifUrl: sent.gifUrl,
        parentId: sent.parentId,
        createdAtLabel: "Just now",
        user: {
          id: viewer.id,
          name: viewer.name,
          avatarUrl: viewer.avatarUrl ?? null,
          frame: viewer.frame ?? null,
        },
        reactions: [],
      },
    ],
  );

  // Comments and replies from other people, their reactions and "is
  // typing…" arrive while you watch.
  const live = useLiveComments({
    recognitionId: card.id,
    viewerId: viewer.id,
    serverComments: card.comments,
    shown,
    open,
  });
  const { onDraftChange, stopTyping, pollNow } = live;
  // Whatever changes the draft (typing, an emoji, Reply) counts as typing.
  useEffect(() => onDraftChange(body), [body, onDraftChange]);

  // My reactions on their way to the server, shown straight away. Each tap
  // gets a number so only the last one in flight clears the override.
  const [mine, setMine] = useState<Record<string, string | null>>({});
  const taps = useRef(new Map<string, number>());

  const reactionsOf = useCallback(
    (c: FeedCardComment): CommentReactionSummary[] => {
      const base = live.reactions ? (live.reactions[c.id] ?? []) : c.reactions;
      return c.id in mine ? withMyReaction(base, mine[c.id]) : base;
    },
    [live.reactions, mine],
  );

  function react(c: FeedCardComment, emoji: string) {
    if (isPending(c)) return;
    const next = nextCommentReaction(reactionsOf(c), emoji);
    const tap = (taps.current.get(c.id) ?? 0) + 1;
    taps.current.set(c.id, tap);
    setMine((m) => ({ ...m, [c.id]: next }));
    const fd = new FormData();
    fd.set("commentId", c.id);
    fd.set("emoji", emoji);
    void toggleCommentReaction(fd)
      .then(async (res) => {
        if (!res.ok) toast.error(res.error);
        await pollNow();
      })
      .catch(() => toast.error("Couldn't react. Try again."))
      .finally(() => {
        if (taps.current.get(c.id) !== tap) return;
        setMine((m) => {
          const rest = { ...m };
          delete rest[c.id];
          return rest;
        });
      });
  }

  function startReply(c: FeedCardComment) {
    if (isPending(c)) return;
    const threadId = c.parentId ?? c.id;
    setReplyTo({ threadId, name: c.user.name });
    setExpanded((s) => new Set(s).add(threadId));
    // Replying to a reply names who it answers, as the thread holds several people.
    if (c.parentId && c.user.id !== viewer.id) {
      setBody((b) => (b.trim() ? b : `@${firstName(c.user.name)} `));
    }
  }

  function cancelReply() {
    setReplyTo(null);
  }

  // Sends the typed text, plus a GIF when one was just picked (picking a GIF
  // sends straight away, with whatever was typed as its caption).
  function send(gifUrl: string | null = null) {
    const value = body.trim();
    if (!value && !gifUrl) return;
    const parentId = replyTo?.threadId ?? null;
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("body", value);
    if (gifUrl) fd.set("gifUrl", gifUrl);
    if (parentId) fd.set("parentId", parentId);
    setBody("");
    setReplyTo(null);
    stopTyping();
    startComment(async () => {
      addOptimisticComment({ body: value, gifUrl, parentId });
      const res = await addComment(fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  function toggleThread(threadId: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  return {
    comments: live.comments,
    typing: live.typing,
    watchRef: live.watchRef,
    body,
    setBody,
    replyTo,
    startReply,
    cancelReply,
    send,
    reactionsOf,
    react,
    expanded,
    toggleThread,
  };
}

export type CardComments = ReturnType<typeof useCardComments>;

/** A comment's text, with a leading "@Name" (who a reply answers) picked out. */
function CommentBody({ body }: { body: string }) {
  const m = /^@(\S+)(\s|$)/.exec(body);
  if (!m) return <p className="mt-0.5 break-words whitespace-pre-line">{body}</p>;
  return (
    <p className="mt-0.5 break-words whitespace-pre-line">
      <span className="text-primary font-semibold">@{m[1]}</span>
      {body.slice(m[1].length + 1)}
    </p>
  );
}

function CommentRow({
  comment: c,
  state,
  reply,
}: {
  comment: FeedCardComment;
  state: CardComments;
  reply?: boolean;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const reactions = state.reactionsOf(c);
  const mine = myCommentReaction(reactions);
  const pending = isPending(c);

  function startPress() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
      setTrayOpen(true);
    }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  function quickReact() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    state.react(c, mine ?? QUICK_EMOJI);
  }
  function pick(emoji: string) {
    state.react(c, emoji);
    setTrayOpen(false);
  }

  return (
    <div className={cn("flex items-start gap-3", pending && "opacity-60")}>
      <Link href={`/profile/${c.user.id}`} className="shrink-0">
        <FramedAvatar
          name={c.user.name}
          avatarUrl={c.user.avatarUrl}
          frame={c.user.frame}
          className={reply ? "size-7 text-[0.6rem]" : "size-9 text-xs"}
        />
      </Link>
      <div className="min-w-0 flex-1 text-[0.9rem] leading-snug">
        <p className="flex items-baseline gap-1.5">
          <Link href={`/profile/${c.user.id}`} className="font-semibold">
            {c.user.name}
          </Link>
          <span className="text-muted text-xs">{c.createdAtLabel}</span>
        </p>
        {c.body && <CommentBody body={c.body} />}
        {c.gifUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.gifUrl}
            alt="GIF"
            loading="lazy"
            className="bg-surface-2 mt-1.5 max-h-48 max-w-[12rem] rounded-xl"
          />
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            onClick={() => state.startReply(c)}
            disabled={pending}
            className="text-muted text-xs font-semibold"
          >
            Reply
          </button>
          <Popover open={trayOpen} onOpenChange={setTrayOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={pending}
                aria-label="React to this comment"
                className="text-muted hover:text-foreground -my-1 flex items-center p-1"
              >
                <SmilePlus className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={6}
              className="shadow-float w-auto rounded-full p-1"
            >
              <div className="flex gap-0.5">
                {REACTION_EMOJIS.map((emoji, i) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pick(emoji)}
                    style={{ "--tray": i } as React.CSSProperties}
                    aria-label={`React ${emoji}`}
                    className={cn(
                      "tray-in rounded-full p-1 text-[1.5rem] leading-none",
                      mine === emoji && "bg-primary/20",
                    )}
                  >
                    <span className="block transition-transform duration-150 hover:-translate-y-1 hover:scale-[1.3] active:scale-[0.85]">
                      {emoji}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => state.react(c, r.emoji)}
              aria-pressed={r.reacted}
              aria-label={`${r.emoji} ${r.count}${r.reacted ? ", including you" : ""}`}
              className={cn(
                "flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold transition-colors active:scale-95",
                r.reacted
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "bg-surface-2 text-muted border-transparent",
              )}
            >
              <span className="text-sm leading-none">{r.emoji}</span>
              <span data-numeric>{formatNumber(r.count)}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Tap to like, hold for the other emoji. */}
      <button
        type="button"
        onClick={quickReact}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
        disabled={pending}
        aria-label={mine ? `Remove your ${mine}` : "Like this comment (hold for more)"}
        aria-pressed={!!mine}
        className="press -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        <span key={mine ?? "none"} className="like-pop text-base leading-none">
          {!mine ? (
            <Heart className="text-muted size-4" strokeWidth={2} />
          ) : mine === QUICK_EMOJI ? (
            <Heart className="size-4 fill-[#ff3040] text-[#ff3040]" strokeWidth={2} />
          ) : (
            mine
          )}
        </span>
      </button>
    </div>
  );
}

/** The comments sheet: every comment, replies under each, and the composer. */
export function CommentsSheet({
  state,
  open,
  onOpenChange,
  viewer,
  description,
  emptyHint,
  placeholderName,
  inputRef,
}: {
  state: CardComments;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer;
  description: string;
  emptyHint: string;
  /** Who a new comment is for, in the composer's placeholder. */
  placeholderName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { comments, typing, body, setBody, replyTo } = state;
  const threads = threadComments(comments);
  const listRef = useRef<HTMLDivElement>(null);
  const count = comments.length;
  // Keep the open sheet scrolled to the newest comment, unless the reader has
  // scrolled up to read older ones.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !open) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 160) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [count, typing.length, open]);

  function reply(c: FeedCardComment) {
    state.startReply(c);
    inputRef.current?.focus();
  }
  const rowState = { ...state, startReply: reply };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    state.send();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
        <SheetHeader className="border-b pt-1 pb-3 text-center">
          <SheetTitle className="text-center text-base">
            Comments{count > 0 && <span className="text-muted font-normal"> · {formatNumber(count)}</span>}
          </SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        <div ref={listRef} className="max-h-[60svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 py-4">
          {count === 0 ? (
            <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-foreground font-display text-lg font-semibold">No comments yet</p>
              <p className="text-sm">{emptyHint}</p>
            </div>
          ) : (
            threads.map(({ comment, replies }) => {
              const open = state.expanded.has(comment.id);
              const visible = open ? replies : replies.slice(0, REPLIES_SHOWN);
              const hidden = replies.length - visible.length;
              return (
                <div key={comment.id}>
                  <CommentRow comment={comment} state={rowState} />
                  {replies.length > 0 && (
                    <div className="mt-3 space-y-3 pl-12">
                      {visible.map((r) => (
                        <CommentRow key={r.id} comment={r} state={rowState} reply />
                      ))}
                      {(hidden > 0 || (open && replies.length > REPLIES_SHOWN)) && (
                        <button
                          type="button"
                          onClick={() => state.toggleThread(comment.id)}
                          className="text-muted flex items-center gap-3 text-xs font-semibold"
                        >
                          <span aria-hidden className="bg-border h-px w-6" />
                          {hidden > 0
                            ? `View ${formatNumber(hidden)} more ${hidden === 1 ? "reply" : "replies"}`
                            : "Hide replies"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <TypingLine users={typing} className="pl-1" />
        </div>
        {/* Quick emoji row + composer pinned to the bottom. */}
        <div className="border-t px-4 pt-2.5 pb-3">
          {replyTo && (
            <div className="text-muted mb-2 flex items-center justify-between rounded-xl px-1 text-xs">
              <span>
                Replying to <span className="text-foreground font-semibold">{replyTo.name}</span>
              </span>
              <button
                type="button"
                onClick={state.cancelReply}
                aria-label="Cancel reply"
                className="hover:text-foreground -m-1 p-1"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="mb-2.5 flex justify-between px-1">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setBody((b) => b + e)}
                className="text-2xl leading-none transition-transform active:scale-90"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2.5">
            <FramedAvatar
              name={viewer.name}
              avatarUrl={viewer.avatarUrl ?? null}
              frame={viewer.frame ?? null}
              className="size-9 shrink-0 text-xs"
            />
            <div className="bg-surface-2 focus-within:ring-primary/40 flex flex-1 items-center rounded-full pl-4 focus-within:ring-2">
              <input
                ref={inputRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && replyTo) {
                    e.stopPropagation();
                    state.cancelReply();
                  }
                }}
                placeholder={
                  replyTo
                    ? `Reply to ${firstName(replyTo.name)}…`
                    : `Add a comment for ${firstName(placeholderName)}…`
                }
                maxLength={500}
                enterKeyHint="send"
                className="placeholder:text-muted h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
              <GifPicker
                onSelect={(gif) => state.send(gif.url)}
                triggerClassName="text-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center transition-colors"
              />
              <button
                type="submit"
                disabled={!body.trim()}
                aria-label={replyTo ? "Post reply" : "Post comment"}
                className="bg-primary disabled:bg-surface-3 disabled:text-muted mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
