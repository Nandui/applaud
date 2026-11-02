"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { Check, ChevronDown, Heart, SendHorizontal, Smile } from "lucide-react";
import { toast } from "sonner";
import { addComment, toggleCommentReaction } from "@/lib/recognition/actions";
import { useLiveComments, TypingLine } from "@/components/feed/live-comments";
import { GifPicker } from "@/components/recognize/gif-picker";
import { REACTION_EMOJIS } from "@/lib/config";
import type { FeedCard, FeedCardComment } from "@/lib/recognition/queries";
import {
  myCommentReaction,
  nextCommentReaction,
  sortThreads,
  threadComments,
  withMyReaction,
  type CommentReactionSummary,
  type CommentSort,
} from "@/lib/recognition/comment-reactions";
import { FramedAvatar } from "@/components/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
/** With a mouse, resting on the heart this long also opens the emoji. */
const HOVER_MS = 600;
/** The curve where a thread's line turns towards a reply, in px. */
const ELBOW_RADIUS_PX = 12;
/** Tallest a composer grows while typing, in px, before it scrolls. */
const COMPOSER_MAX_PX = 128;

/** The composer's emoji button. */
const COMPOSER_EMOJI = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "🥳", "😅", "😭", "😮",
  "🤔", "🙃", "😴", "🫶", "👏", "🙌", "👍", "🙏", "💪", "🤝", "👀", "✨",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "🎉", "🏆", "⭐", "💯", "✅",
] as const;

const SORTS: { value: CommentSort; label: string; hint: string }[] = [
  { value: "relevant", label: "Most relevant", hint: "Most reactions and replies first" },
  { value: "newest", label: "Newest", hint: "All comments, newest first" },
  { value: "all", label: "All comments", hint: "All comments, in the order they were posted" },
];

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
  /** The draft of a new comment, in the composer at the bottom. */
  const [body, setBody] = useState("");
  /** Replying to this thread (always a top-level comment), and to whom. */
  const [replyTo, setReplyTo] = useState<{ threadId: string; name: string } | null>(null);
  /** The draft in the reply box under that thread. */
  const [replyBody, setReplyBody] = useState("");
  /** Threads whose replies are showing; replies start folded away. */
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
  // Whatever changes a draft (typing, an emoji, Reply) counts as typing.
  useEffect(() => onDraftChange(body + replyBody), [body, replyBody, onDraftChange]);

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
    // Replying to a reply names who it answers, as the thread holds several
    // people. A draft already going in this thread is kept.
    const mention = c.parentId && c.user.id !== viewer.id ? `@${firstName(c.user.name)} ` : "";
    setReplyBody((b) => (b.trim() && replyTo?.threadId === threadId ? b : mention));
  }

  function cancelReply() {
    setReplyTo(null);
    setReplyBody("");
  }

  function post(value: string, parentId: string | null, gifUrl: string | null) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("body", value);
    if (gifUrl) fd.set("gifUrl", gifUrl);
    if (parentId) fd.set("parentId", parentId);
    stopTyping();
    startComment(async () => {
      addOptimisticComment({ body: value, gifUrl, parentId });
      const res = await addComment(fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  // Each sends its typed text, plus a GIF or sticker when one was just picked
  // (picking one sends straight away, with whatever was typed as its caption).
  function sendComment(gifUrl: string | null = null) {
    const value = body.trim();
    if (!value && !gifUrl) return;
    setBody("");
    post(value, null, gifUrl);
  }

  function sendReply(gifUrl: string | null = null) {
    const value = replyBody.trim();
    if (!replyTo || (!value && !gifUrl)) return;
    setReplyBody("");
    setReplyTo(null);
    post(value, replyTo.threadId, gifUrl);
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
    replyBody,
    setReplyBody,
    replyTo,
    startReply,
    cancelReply,
    sendComment,
    sendReply,
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
  if (!m) return <p className="break-words whitespace-pre-line">{body}</p>;
  return (
    <p className="break-words whitespace-pre-line">
      <span className="text-primary font-semibold">@{m[1]}</span>
      {body.slice(m[1].length + 1)}
    </p>
  );
}

/**
 * The reactions on a comment as one stack of emoji and a total, like
 * Facebook's. Tapping it lists each emoji's count; tapping one of those
 * reacts with it.
 */
function ReactionSummary({
  reactions,
  onReact,
}: {
  reactions: CommentReactionSummary[];
  onReact: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return null;
  const top = [...reactions].sort((a, b) => b.count - a.count).slice(0, 3);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${formatNumber(total)} ${total === 1 ? "reaction" : "reactions"}: ${reactions
            .map((r) => `${r.emoji} ${r.count}`)
            .join(", ")}`}
          className="hover:text-foreground flex items-center gap-1 font-normal"
        >
          <span className="flex -space-x-1">
            {top.map((r, i) => (
              <span
                key={r.emoji}
                style={{ zIndex: top.length - i }}
                className="bg-surface ring-surface relative flex size-[1.15rem] items-center justify-center rounded-full text-[0.75rem] leading-none ring-2"
              >
                {r.emoji}
              </span>
            ))}
          </span>
          <span data-numeric>{formatNumber(total)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={6} className="shadow-float w-auto min-w-36 rounded-2xl p-1.5">
        <ul>
          {reactions.map((r) => (
            <li key={r.emoji}>
              <button
                type="button"
                onClick={() => {
                  onReact(r.emoji);
                  setOpen(false);
                }}
                aria-pressed={r.reacted}
                className={cn(
                  "hover:bg-surface-2 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm",
                  r.reacted && "text-primary font-semibold",
                )}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                <span data-numeric>{formatNumber(r.count)}</span>
                {r.reacted && <span className="text-muted ml-auto pl-3 text-xs font-normal">incl. you</span>}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function CommentRow({
  comment: c,
  state,
  reply,
  threadLine,
}: {
  comment: FeedCardComment;
  state: CardComments;
  reply?: boolean;
  /** Draw the thread's line down from the avatar to the replies below. */
  threadLine?: boolean;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const likeRef = useRef<HTMLButtonElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  function startHover(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    hoverTimer.current = setTimeout(() => setTrayOpen(true), HOVER_MS);
  }
  function endHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }
  function quickReact() {
    endHover();
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
    <div className={cn("relative flex items-start gap-2.5", pending && "opacity-60")}>
      {threadLine && (
        <span aria-hidden className="border-border absolute top-10 bottom-0 left-[17px] border-l-2" />
      )}
      <Link href={`/profile/${c.user.id}`} className="shrink-0">
        <FramedAvatar
          name={c.user.name}
          avatarUrl={c.user.avatarUrl}
          frame={c.user.frame}
          className={reply ? "size-7 text-[0.6rem]" : "size-9 text-xs"}
        />
      </Link>
      <div className="min-w-0 flex-1 text-[0.9rem] leading-snug">
        <p className="flex flex-wrap items-baseline gap-x-1 text-[0.82rem]">
          <Link href={`/profile/${c.user.id}`} className="font-semibold">
            {c.user.name}
          </Link>
          <span className="text-muted text-xs">· {c.createdAtLabel}</span>
        </p>
        {c.body && <CommentBody body={c.body} />}
        {c.gifUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.gifUrl}
            alt="GIF"
            loading="lazy"
            className="mt-1.5 max-h-48 max-w-[12rem] rounded-xl"
          />
        )}
        <div className="text-muted mt-1 flex min-h-6 items-center gap-4 text-xs font-semibold">
          {pending ? (
            <span className="font-normal">Posting…</span>
          ) : (
            <>
              {/* Tap to like, hold (or rest the mouse on it) for the other emoji. */}
              <button
                ref={likeRef}
                type="button"
                onClick={quickReact}
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerEnter={startHover}
                onPointerLeave={() => {
                  endPress();
                  endHover();
                }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={mine ? `Remove your ${mine}` : "Like (hold for more)"}
                aria-pressed={!!mine}
                className="press hover:text-foreground -m-1.5 flex items-center p-1.5"
              >
                <span key={mine ?? "none"} className="like-pop flex size-4 items-center justify-center text-sm leading-none">
                  {!mine ? (
                    <Heart className="size-4" strokeWidth={2} />
                  ) : mine === QUICK_EMOJI ? (
                    <Heart className="size-4 fill-[#ff3040] text-[#ff3040]" strokeWidth={2} />
                  ) : (
                    mine
                  )}
                </span>
              </button>
              <Popover open={trayOpen} onOpenChange={setTrayOpen}>
                <PopoverContent
                  anchor={likeRef}
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
              <button
                type="button"
                onClick={() => state.startReply(c)}
                className="hover:text-foreground"
              >
                Reply
              </button>
              <ReactionSummary reactions={reactions} onReact={(emoji) => state.react(c, emoji)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One item hanging off a thread (a reply, "View N replies", the reply box),
 * joined to the line from the comment's avatar by a rounded elbow that meets
 * the item `elbow` px down.
 */
function Branch({ last, elbow, children }: { last: boolean; elbow: number; children: React.ReactNode }) {
  return (
    <div className="relative pt-3 pl-12">
      {/* The line carries on to the next item from where the elbow starts to curve. */}
      {!last && (
        <span
          aria-hidden
          style={{ top: elbow - ELBOW_RADIUS_PX }}
          className="border-border absolute bottom-0 left-[17px] border-l-2"
        />
      )}
      <span
        aria-hidden
        style={{ height: elbow, borderBottomLeftRadius: ELBOW_RADIUS_PX }}
        className="border-border absolute top-0 left-[17px] w-[1.6rem] border-b-2 border-l-2"
      />
      {children}
    </div>
  );
}

/** Emoji, GIF and sticker buttons for a composer. */
function ComposerTools({
  onEmoji,
  onGif,
}: {
  onEmoji: (emoji: string) => void;
  onGif: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const tool =
    "text-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors";
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Add an emoji" className={tool}>
            <Smile className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={8} className="shadow-float w-auto rounded-2xl p-2">
          <div className="grid grid-cols-6 gap-0.5">
            {COMPOSER_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onEmoji(e);
                  setOpen(false);
                }}
                aria-label={`Insert ${e}`}
                className="hover:bg-surface-2 flex size-10 items-center justify-center rounded-xl text-2xl leading-none transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <GifPicker onSelect={(gif) => onGif(gif.url)} triggerClassName={tool} />
      <GifPicker kind="stickers" onSelect={(gif) => onGif(gif.url)} triggerClassName={tool} />
    </>
  );
}

/**
 * A comment box that grows as you type, with emoji, GIF and sticker buttons.
 * The bottom composer puts them on a row under the text, like Facebook's; the
 * smaller reply box keeps them beside it. Enter sends, Shift+Enter is a new line.
 */
function Composer({
  value,
  onChange,
  onSend,
  onEscape,
  placeholder,
  inputRef,
  compact,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (gifUrl?: string) => void;
  onEscape?: () => void;
  placeholder: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  label: string;
}) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [value, inputRef]);

  // An emoji goes in where the cursor is.
  function insert(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  const canSend = value.trim().length > 0;
  const send = (
    <button
      type="submit"
      disabled={!canSend}
      aria-label={label}
      className="text-primary disabled:text-muted/60 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
    >
      <SendHorizontal className="size-5" />
    </button>
  );
  const tools = <ComposerTools onEmoji={insert} onGif={(url) => onSend(url)} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className={cn(
        "bg-surface-2 focus-within:ring-primary/40 min-w-0 flex-1 rounded-2xl focus-within:ring-2",
        compact && "flex items-end",
      )}
    >
      <textarea
        ref={inputRef}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          } else if (e.key === "Escape" && onEscape) {
            e.stopPropagation();
            onEscape();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={500}
        enterKeyHint="send"
        className={cn(
          "placeholder:text-muted block min-w-0 resize-none border-0 bg-transparent text-sm leading-5 outline-none",
          compact ? "flex-1 py-2 pl-3.5" : "w-full px-3.5 pt-2.5 pb-1",
        )}
      />
      {compact ? (
        <div className="flex shrink-0 items-center pr-1 pb-0.5">
          {tools}
          {send}
        </div>
      ) : (
        <div className="flex items-center justify-between px-1.5 pb-1">
          <div className="flex items-center">{tools}</div>
          {send}
        </div>
      )}
    </form>
  );
}

function SortMenu({ sort, onChange }: { sort: CommentSort; onChange: (sort: CommentSort) => void }) {
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-muted hover:text-foreground -mx-1 flex items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-semibold"
        >
          {current.label}
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-2xl p-1.5">
        {SORTS.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className="flex items-start gap-3 rounded-xl px-3 py-2"
          >
            <span className="flex-1">
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="text-muted block text-xs">{s.hint}</span>
            </span>
            {sort === s.value && <Check className="text-primary mt-0.5 size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The comments sheet, laid out like Facebook's: a sort menu, each comment with
 * Like, Reply and its reactions, replies folded under "View N replies" on a
 * thread line, a reply box that opens under the comment you answer, and the
 * composer at the bottom.
 */
export function CommentsSheet({
  state,
  open,
  onOpenChange,
  viewer,
  description,
  emptyHint,
  inputRef,
}: {
  state: CardComments;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer;
  description: string;
  emptyHint: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { comments, typing, replyTo } = state;
  const threads = threadComments(comments);
  const listRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const count = comments.length;
  const [sort, setSort] = useState<CommentSort>("relevant");

  // The order is worked out when the sheet opens or the sort changes, then
  // held, so comments don't jump about as reactions come in. Comments posted
  // since go at the end (at the top for Newest).
  const rankKey = `${open}|${sort}`;
  const [ranking, setRanking] = useState({ key: "", ids: [] as string[] });
  if (ranking.key !== rankKey) {
    setRanking({ key: rankKey, ids: sortThreads(threads, sort, state.reactionsOf).map((t) => t.comment.id) });
  }
  const position = new Map(ranking.ids.map((id, i) => [id, i]));
  const ranked = threads
    .filter((t) => position.has(t.comment.id))
    .sort((a, b) => (position.get(a.comment.id) ?? 0) - (position.get(b.comment.id) ?? 0));
  const fresh = threads.filter((t) => !position.has(t.comment.id));
  const ordered = sort === "newest" ? [...fresh.reverse(), ...ranked] : [...ranked, ...fresh];

  // Follow new comments to the end of the list (the top for Newest) unless
  // the reader has scrolled away to read others; always after posting one.
  const jump = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !open) return;
    if (sort === "newest") {
      if (jump.current || list.scrollTop < 160) list.scrollTo({ top: 0, behavior: "smooth" });
    } else if (jump.current || list.scrollHeight - list.scrollTop - list.clientHeight < 160) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
    jump.current = false;
  }, [count, typing.length, open, sort]);

  // Reply puts the cursor in the reply box under that comment.
  useEffect(() => {
    const el = replyRef.current;
    if (!replyTo || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [replyTo]);

  function sendComment(gifUrl?: string) {
    jump.current = true;
    state.sendComment(gifUrl ?? null);
  }

  function changeSort(next: CommentSort) {
    setSort(next);
    listRef.current?.scrollTo({ top: 0 });
  }

  const typingLine = <TypingLine users={typing} className="pl-1" />;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
        <SheetHeader className="border-b pt-1 pb-3 text-center">
          <SheetTitle className="text-center text-base">
            Comments{count > 0 && <span className="text-muted font-normal"> · {formatNumber(count)}</span>}
          </SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        <div ref={listRef} className="max-h-[60svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 pt-3 pb-4">
          {count === 0 ? (
            <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-foreground font-display text-lg font-semibold">No comments yet</p>
              <p className="text-sm">{emptyHint}</p>
            </div>
          ) : (
            <>
              {threads.length > 1 && <SortMenu sort={sort} onChange={changeSort} />}
              {sort === "newest" && typingLine}
              {ordered.map(({ comment, replies }) => {
                const showing = state.expanded.has(comment.id);
                const replying = replyTo?.threadId === comment.id;
                const items: { key: string; elbow: number; node: React.ReactNode }[] = [];
                if (showing) {
                  for (const r of replies) {
                    items.push({ key: r.id, elbow: 26, node: <CommentRow comment={r} state={state} reply /> });
                  }
                } else if (replies.length > 0) {
                  items.push({
                    key: "more",
                    elbow: 21,
                    node: (
                      <button
                        type="button"
                        onClick={() => state.toggleThread(comment.id)}
                        className="text-muted hover:text-foreground text-[0.82rem] font-semibold"
                      >
                        View {formatNumber(replies.length)} {replies.length === 1 ? "reply" : "replies"}
                      </button>
                    ),
                  });
                }
                if (replying) {
                  items.push({
                    key: "reply-box",
                    elbow: 30,
                    node: (
                      <div className="flex items-start gap-2">
                        <FramedAvatar
                          name={viewer.name}
                          avatarUrl={viewer.avatarUrl ?? null}
                          frame={viewer.frame ?? null}
                          className="mt-1 size-7 shrink-0 text-[0.6rem]"
                        />
                        <Composer
                          compact
                          value={state.replyBody}
                          onChange={state.setReplyBody}
                          onSend={(gif) => state.sendReply(gif ?? null)}
                          onEscape={state.cancelReply}
                          placeholder={`Reply to ${replyTo.name}`}
                          inputRef={replyRef}
                          label="Post reply"
                        />
                      </div>
                    ),
                  });
                }
                return (
                  <div key={comment.id}>
                    <CommentRow comment={comment} state={state} threadLine={items.length > 0} />
                    {items.map((item, i) => (
                      <Branch key={item.key} last={i === items.length - 1} elbow={item.elbow}>
                        {item.node}
                      </Branch>
                    ))}
                  </div>
                );
              })}
            </>
          )}
          {sort !== "newest" && typingLine}
        </div>
        <div className="flex items-start gap-2.5 border-t px-4 pt-3 pb-3">
          <FramedAvatar
            name={viewer.name}
            avatarUrl={viewer.avatarUrl ?? null}
            frame={viewer.frame ?? null}
            className="mt-0.5 size-9 shrink-0 text-xs"
          />
          <Composer
            value={state.body}
            onChange={state.setBody}
            onSend={sendComment}
            placeholder={`Comment as ${viewer.name}`}
            inputRef={inputRef}
            label="Post comment"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
