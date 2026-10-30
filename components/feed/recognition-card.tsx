"use client";

import {
  Fragment,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  Sparkles,
  Lock,
  Heart,
  MessageCircle,
  SmilePlus,
  Send,
  Ellipsis,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toggleReaction, addComment, toggleBoost, deletePost } from "@/lib/recognition/actions";
import { togglePin } from "@/lib/profile-actions";
import {
  REACTION_EMOJIS,
  BOOSTS,
  boostForRole,
  boostMultiplier,
  type BoostType,
} from "@/lib/config";
import type { FeedCard } from "@/lib/recognition/queries";
import { FramedAvatar } from "@/components/user-avatar";
import { DEFAULT_LOOK } from "@/lib/cosmetics";
import { isLight } from "@/lib/contrast";
import { optimizedImage } from "@/lib/image-url";
import { ValueSeal } from "@/components/value-seal";
import { PostBanner } from "@/components/feed/post-banner";
import { useLiveComments, TypingLine } from "@/components/feed/live-comments";
import { tint } from "@/components/value-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNumber, pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  /** The viewer's equipped frame, for their own optimistic comments. */
  frame?: string | null;
};

/** The one-tap reaction: a plain Instagram-style like. */
const QUICK_EMOJI = "❤️";
/** Messages longer than this also appear in full as a caption under the quote card. */
const QUOTE_MAX = 160;
/** Hold the applaud button this long to open the reaction tray (iMessage tapback). */
const LONG_PRESS_MS = 380;

/** Fixed display order for reaction chips so reacting never reshuffles them. */
function reactionRank(emoji: string): number {
  const i = (REACTION_EMOJIS as readonly string[]).indexOf(emoji);
  return i === -1 ? REACTION_EMOJIS.length : i;
}

/**
 * Optimistically set the viewer's single reaction (one per person): the same
 * emoji toggles off, a different one switches. Keeps per-emoji counts and the
 * reactor lists in sync so the "who reacted" sheet updates instantly too.
 */
function switchReaction(
  state: FeedCard["reactions"],
  emoji: string,
  viewer: Viewer,
): FeedCard["reactions"] {
  const me = {
    id: viewer.id,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl ?? null,
    frame: viewer.frame ?? null,
  };
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
 * A shout-out without a photo becomes a card for the person it's for: their
 * own banner from the profile shop, their framed avatar large, and the
 * message as a quote. So what people buy shows up every time they're
 * recognised.
 */
function BannerHero({ card }: { card: FeedCard }) {
  const people = card.recipients.slice(0, 3);
  const extra = card.recipients.length - people.length;
  const lead = card.recipients[0];
  return (
    <div
      className="relative flex aspect-[5/4] flex-col items-center justify-center gap-3 px-6 text-center text-white"
      style={{ background: lead?.look.banner ?? DEFAULT_LOOK.banner }}
    >
      <div aria-hidden className="absolute inset-0 bg-black/10" />
      {people.length > 0 && (
        <div className="relative flex items-center">
          {people.map((r, i) => (
            <Link
              key={r.id}
              href={`/profile/${r.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(i > 0 && "-ml-5")}
              style={{ zIndex: people.length - i }}
            >
              <FramedAvatar
                name={r.name}
                avatarUrl={r.avatarUrl}
                frame={r.look.frame}
                gapClassName="bg-white"
                className={people.length === 1 ? "size-28 text-3xl" : "size-20 text-xl"}
                large
              />
            </Link>
          ))}
        </div>
      )}
      {extra > 0 && (
        <span className="relative -mt-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold">+{extra} more</span>
      )}
      <p
        className={cn(
          "relative line-clamp-5 max-w-sm leading-snug font-bold tracking-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.35)]",
          card.message.length > 90 ? "text-lg" : "text-2xl",
        )}
      >
        {card.system ? card.message : `“${card.message}”`}
      </p>
    </div>
  );
}

/** The feed column is at most 576px wide; photos are resized to fit it. */
const MEDIA_WIDTH = 600;

/** Photos and GIFs full width, swipeable when there are several (Instagram carousel). */
function MediaHero({ urls }: { urls: string[] }) {
  const [at, setAt] = useState(0);
  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimizedImage(urls[0], MEDIA_WIDTH)}
        alt="Shout-out photo"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="max-h-[36rem] min-h-64 w-full object-cover"
      />
    );
  }
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={optimizedImage(url, MEDIA_WIDTH)}
            alt={`Photo ${i + 1} of ${urls.length}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="aspect-[4/5] w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      <span data-numeric className="absolute top-3 left-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
        {at + 1}/{urls.length}
      </span>
    </div>
  );
}

export function RecognitionCard({
  card,
  viewer,
  index = 0,
  pinned,
}: {
  card: FeedCard;
  viewer: Viewer;
  index?: number;
  /**
   * Whether this shout-out is pinned to the viewer's profile. Only meaningful
   * (and the pin menu only shown) when the viewer is one of the recipients.
   */
  pinned?: boolean;
}) {
  const [, startReaction] = useTransition();
  const [, startComment] = useTransition();
  const [boostPending, startBoost] = useTransition();
  const [pinPending, startPin] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [body, setBody] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Optimistic state so claps and comments land instantly, then reconcile with
  // the server's revalidated data — the snappy feel of a social app.
  const [reactions, applyReaction] = useOptimistic(
    card.reactions,
    (state: FeedCard["reactions"], emoji: string) =>
      switchReaction(state, emoji, viewer),
  );
  const [shownComments, addOptimisticComment] = useOptimistic(
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
          frame: viewer.frame ?? null,
        },
      },
    ],
  );

  // Comments from other people and "is typing…" arrive while you watch.
  const {
    comments,
    typing,
    watchRef,
    onDraftChange,
    stopTyping,
  } = useLiveComments({
    recognitionId: card.id,
    viewerId: viewer.id,
    serverComments: card.comments,
    shown: shownComments,
    open: commentsOpen,
  });
  const commentListRef = useRef<HTMLDivElement>(null);
  const commentCount = comments.length;
  // Keep the open sheet scrolled to the newest comment, unless the reader has
  // scrolled up to read older ones.
  useEffect(() => {
    const list = commentListRef.current;
    if (!list || !commentsOpen) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 160) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [commentCount, typing.length, commentsOpen]);

  function react(emoji: string) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("emoji", emoji);
    startReaction(async () => {
      applyReaction(emoji);
      await toggleReaction(fd);
    });
  }

  const myReaction = reactions.find((r) => r.reacted)?.emoji ?? null;

  /** The applaud button: claps, or takes back whatever I reacted with. */
  function quickReact() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (!myReaction) setBurst((b) => b + 1);
    react(myReaction ?? QUICK_EMOJI);
  }

  function startPress() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
      setReactOpen(true);
    }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  /** Double-tap the post to like it (never un-likes, like Instagram). */
  function onBodyTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setBurst((b) => b + 1);
      if (!myReaction) react(QUICK_EMOJI);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  function pickReaction(emoji: string) {
    if (emoji !== myReaction) setBurst((b) => b + 1);
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

  function onPin() {
    setMenuOpen(false);
    startPin(async () => {
      const res = await togglePin(card.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDelete(async () => {
      const res = await deletePost(card.id);
      if (res.ok) {
        setMenuOpen(false);
        setDeleted(true);
        toast.success(res.message);
      } else toast.error(res.error);
    });
  }

  function openComments(focus = false) {
    setCommentsOpen(true);
    if (focus) setTimeout(() => commentInputRef.current?.focus(), 350);
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
    stopTyping();
    startComment(async () => {
      addOptimisticComment(value);
      await addComment(fd);
    });
  }

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

  const sortedReactions = [...reactions].sort(
    (a, b) => reactionRank(a.emoji) - reactionRank(b.emoji),
  );
  const totalReactions = reactions.reduce((n, r) => n + r.count, 0);
  // "Sorcha and N others": lead with someone other than me when possible.
  const allReactors = sortedReactions.flatMap((r) => r.users);
  const leadReactor =
    allReactors.find((u) => u.id !== viewer.id) ?? allReactors[0] ?? null;

  const isPost = card.kind === "post";
  const canPin =
    pinned !== undefined && !card.system && card.recipients.some((r) => r.id === viewer.id);
  // Posts can be deleted by whoever wrote them, and by admins (moderation).
  const canDelete = isPost && (card.sender.id === viewer.id || viewer.role === "admin");

  const people = card.recipients.slice(0, 3);
  const accent = card.recipients[0]?.look.theme ?? DEFAULT_LOOK.theme;
  const hasMedia = card.imageUrls.length > 0;
  // Who the post is about: the recipients of a shout-out, the author of a post.
  const subjectName = isPost ? card.sender.name : card.recipients[0]?.name;

  if (deleted) return null;

  return (
    <article
      className="card-in pt-3 pb-6"
      style={{ "--card": Math.min(index, 6) } as React.CSSProperties}
    >
      {/* Header: who it's for, big; who sent it underneath. */}
      <header className="flex items-center gap-3">
        {isPost ? (
          <Link href={`/profile/${card.sender.id}`} className="shrink-0">
            <FramedAvatar
              name={card.sender.name}
              avatarUrl={card.sender.avatarUrl}
              frame={card.sender.look.frame}
              className="size-11 text-sm"
            />
          </Link>
        ) : people.length > 0 ? (
          <div className="flex shrink-0 items-center">
            {people.map((r, i) => (
              <Link
                key={r.id}
                href={`/profile/${r.id}`}
                className={cn(i > 0 && "-ml-4")}
                style={{ zIndex: people.length - i }}
              >
                <FramedAvatar
                  name={r.name}
                  avatarUrl={r.avatarUrl}
                  frame={r.look.frame}
                  className="size-11 text-sm"
                />
              </Link>
            ))}
          </div>
        ) : (
          <span className="bg-brand flex size-11 shrink-0 items-center justify-center rounded-full text-white">
            <Sparkles className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[1.05rem] font-bold tracking-tight">
            {isPost ? (
              <Link href={`/profile/${card.sender.id}`}>{card.sender.name}</Link>
            ) : (
              card.recipients.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && (i === card.recipients.length - 1 ? " & " : ", ")}
                  <Link href={`/profile/${r.id}`}>{r.name}</Link>
                </Fragment>
              ))
            )}
          </p>
          <p className="text-muted mt-0.5 flex items-center gap-1 truncate text-[0.82rem]">
            {isPost ? (
              card.sender.jobTitle && <span className="truncate">{card.sender.jobTitle}</span>
            ) : card.system ? (
              <span>{card.sender.name}</span>
            ) : (
              <>
                recognised by
                <Link href={`/profile/${card.sender.id}`} className="text-foreground font-semibold">
                  {card.sender.name}
                </Link>
              </>
            )}
            <time title={card.createdAtFull}>
              {isPost && !card.sender.jobTitle ? "" : "· "}
              {card.createdAtLabel}
            </time>
            {card.visibility === "private" && <Lock className="size-3.5 shrink-0" aria-label="Private" />}
          </p>
        </div>
        {(canPin || canDelete) && (
          <Popover
            open={menuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open);
              if (!open) setConfirmDelete(false);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="text-muted hover:bg-surface-2 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                {pinned ? <Pin className="text-primary size-4 fill-current" /> : <Ellipsis className="size-5" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 rounded-2xl p-1.5">
              {canPin && (
                <button
                  type="button"
                  onClick={onPin}
                  disabled={pinPending}
                  className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                >
                  {pinned ? <PinOff className="size-4.5" /> : <Pin className="size-4.5" />}
                  {pinned ? "Unpin from profile" : "Pin to profile"}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deletePending}
                  className={cn(
                    "text-danger flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-50",
                    confirmDelete ? "bg-danger/10" : "hover:bg-surface-2",
                  )}
                >
                  <Trash2 className="size-4.5" />
                  {confirmDelete ? "Tap again to delete" : "Delete post"}
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </header>

      {/* The picture: their photo/GIF, or the recipient's own banner and frame.
          Double-tap applauds. */}
      <div
        className={cn(
          "relative -mx-4 mt-3 overflow-hidden select-none md:mx-0",
          // Posts have no "Recognised for" band underneath to round off.
          isPost ? "md:rounded-2xl" : "md:rounded-t-2xl",
        )}
        onClick={onBodyTap}
      >
        {hasMedia ? (
          <MediaHero urls={card.imageUrls} />
        ) : isPost ? (
          <PostBanner banner={card.sender.look.banner} message={card.message} />
        ) : (
          <BannerHero card={card} />
        )}

        {/* Applause burst on double-tap / clap */}
        {burst > 0 && (
          <span
            key={burst}
            aria-hidden
            onAnimationEnd={() => setBurst((b) => (b === burst ? 0 : b))}
            className="like-burst pointer-events-none absolute inset-0 m-auto flex size-28 items-center justify-center text-8xl drop-shadow-xl"
          >
            {myReaction ?? QUICK_EMOJI}
          </span>
        )}
      </div>

      {/* What it's for: the value's medal and name, with the points earned. */}
      {(card.value || card.pointsEach > 0) && (
        <div
          className="-mx-4 flex items-center gap-3 px-4 py-2.5 md:mx-0 md:rounded-b-2xl"
          style={{ backgroundColor: tint(card.value?.color ?? accent, 0.14) ?? "var(--surface)" }}
        >
          {card.value ? (
            <>
              <ValueSeal value={card.value} size="sm" ribbon={false} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-muted text-[0.7rem] font-semibold tracking-wider uppercase">Recognised for</p>
                <p
                  className="truncate text-[1.05rem] font-extrabold"
                  style={{ color: card.value.color ?? undefined }}
                >
                  {card.value.name}
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1" />
          )}
          {card.pointsEach > 0 && (
            <span
              data-numeric
              className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: accent, color: isLight(accent) ? "#0a0a0a" : "#fff" }}
            >
              +{pts(effectivePoints)}
              {activeBoost && (
                <span aria-label={`${activeBoost.label} boost`}>
                  · {activeBoost.emoji} {activeBoost.multiplier}×
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="-ml-2.5 mt-1 flex items-center">
        <button
          type="button"
          onClick={quickReact}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={myReaction ? `Remove your ${myReaction}` : "Like (hold for more reactions)"}
          aria-pressed={!!myReaction}
          className="press flex size-11 items-center justify-center rounded-full"
        >
          <span key={myReaction ?? "none"} className="like-pop text-[1.5rem] leading-none">
            {!myReaction ? (
              <Heart className="size-6.5" strokeWidth={1.8} />
            ) : myReaction === QUICK_EMOJI ? (
              <Heart className="size-6.5 fill-[#ff3040] text-[#ff3040]" strokeWidth={1.8} />
            ) : (
              myReaction
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openComments(true)}
          aria-label="Comment"
          className="press flex size-11 items-center justify-center rounded-full"
        >
          <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
        </button>

        {/* Tray anchors here; holding the applaud button opens it too. */}
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Pick a reaction"
              className="press flex size-11 items-center justify-center rounded-full"
            >
              <SmilePlus className="size-6" strokeWidth={1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-auto rounded-full p-1.5 shadow-float"
          >
            <div className="flex gap-0.5">
              {REACTION_EMOJIS.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pickReaction(emoji)}
                  style={{ "--tray": i } as React.CSSProperties}
                  aria-label={`React ${emoji}`}
                  className={cn(
                    "tray-in rounded-full p-1.5 text-[1.8rem] leading-none",
                    myReaction === emoji && "bg-primary/20",
                  )}
                >
                  {/* Hover lift on the inner span so it doesn't fight the entrance animation. */}
                  <span className="block transition-transform duration-150 hover:-translate-y-1.5 hover:scale-[1.35] active:scale-[0.85]">
                    {emoji}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {boostMode && myBoostType && (
          <button
            type="button"
            onClick={() => onBoost(myBoostType)}
            disabled={boostPending}
            className={cn(
              "ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-transform active:scale-[0.92] disabled:opacity-50",
              boostMode === "remove" ? "bg-surface-2 text-foreground" : "bg-brand text-white",
            )}
          >
            <span aria-hidden>{BOOSTS[myBoostType].emoji}</span>
            {boostMode === "remove" ? "Remove boost" : `Boost ${BOOSTS[myBoostType].multiplier}×`}
          </button>
        )}
      </div>

      {/* "Liked by Sorcha and 3 others" */}
      {totalReactions > 0 && leadReactor && (
        <button
          type="button"
          onClick={() => setReactorsOpen(true)}
          className="block text-left text-[0.9rem]"
        >
          {sortedReactions.slice(0, 3).map((r) => (
            <Fragment key={r.emoji}>{r.emoji}</Fragment>
          ))}{" "}
          Liked by <span className="font-semibold">{leadReactor.name}</span>
          {totalReactions > 1 && (
            <>
              {" "}and{" "}
              <span className="font-semibold">
                <span data-numeric>{totalReactions - 1}</span>{" "}
                {totalReactions - 1 === 1 ? "other" : "others"}
              </span>
            </>
          )}
        </button>
      )}

      {/* Caption: the message, unless the picture already shows it in full. */}
      {!card.system && (hasMedia || card.message.length > QUOTE_MAX) && (
        <p className="mt-1 text-[0.95rem] leading-snug break-words whitespace-pre-line">
          <Link href={`/profile/${card.sender.id}`} className="mr-1.5 font-semibold">
            {card.sender.name}
          </Link>
          {card.message}
        </p>
      )}

      {comments.length > 2 && (
        <button type="button" onClick={() => openComments()} className="text-muted mt-1 block text-[0.9rem]">
          View all {formatNumber(comments.length)} comments
        </button>
      )}
      <span ref={watchRef} aria-hidden className="block" />
      {comments.slice(-2).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => openComments()}
          className="mt-0.5 block w-full truncate text-left text-[0.9rem]"
        >
          <span className="mr-1.5 font-semibold">{c.user.name}</span>
          {c.body}
        </button>
      ))}
      {!commentsOpen && <TypingLine users={typing} className="mt-1" />}

      {/* Comments sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3 text-center">
            <SheetTitle className="text-center text-base">Comments</SheetTitle>
            <SheetDescription className="sr-only">
              Comments on {card.sender.name}&apos;s {isPost ? "post" : "shout-out"}
            </SheetDescription>
          </SheetHeader>
          <div ref={commentListRef} className="max-h-[55svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 py-4">
            {comments.length === 0 ? (
              <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-foreground font-display text-lg font-semibold">
                  No comments yet
                </p>
                <p className="text-sm">{isPost ? "Start the conversation 💬" : "Be the first to hype them up 🙌"}</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <Link href={`/profile/${c.user.id}`} className="shrink-0">
                    <FramedAvatar
                      name={c.user.name}
                      avatarUrl={c.user.avatarUrl}
                      frame={c.user.frame}
                      className="size-9 text-xs"
                    />
                  </Link>
                  <div className="min-w-0 flex-1 text-[0.9rem] leading-snug">
                    <p className="flex items-baseline gap-1.5">
                      <Link href={`/profile/${c.user.id}`} className="font-semibold">
                        {c.user.name}
                      </Link>
                      <span className="text-muted text-xs">{c.createdAtLabel}</span>
                    </p>
                    <p className="mt-0.5 break-words whitespace-pre-line">{c.body}</p>
                    <button
                      type="button"
                      onClick={() => replyTo(c.user.name)}
                      className="text-muted mt-1 text-xs font-semibold"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              ))
            )}
            <TypingLine users={typing} className="pl-1" />
          </div>
          {/* Quick emoji row + composer pinned to the bottom. */}
          <div className="border-t px-4 pt-2.5 pb-3">
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
            <form onSubmit={submitComment} className="flex items-center gap-2.5">
              <FramedAvatar
                name={viewer.name}
                avatarUrl={viewer.avatarUrl ?? null}
                frame={viewer.frame ?? null}
                className="size-9 shrink-0 text-xs"
              />
              <div className="bg-surface-2 focus-within:ring-primary/40 flex flex-1 items-center rounded-full pl-4 focus-within:ring-2">
                <input
                  ref={commentInputRef}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    onDraftChange(e.target.value);
                  }}
                  placeholder={`Add a comment for ${subjectName?.split(" ")[0] ?? "them"}…`}
                  maxLength={500}
                  enterKeyHint="send"
                  className="placeholder:text-muted h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!body.trim()}
                  aria-label="Post comment"
                  className="bg-primary disabled:bg-surface-3 disabled:text-muted mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Who reacted sheet */}
      <Sheet open={reactorsOpen} onOpenChange={setReactorsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3">
            <SheetTitle className="text-center text-base">Reactions</SheetTitle>
            <SheetDescription className="sr-only">
              People who reacted to this {isPost ? "post" : "shout-out"}
            </SheetDescription>
          </SheetHeader>
          <ul className="max-h-[60svh] overflow-y-auto py-2">
            {sortedReactions.flatMap((r) =>
              r.users.map((u) => (
                <li key={`${r.emoji}-${u.id}`}>
                  <Link
                    href={`/profile/${u.id}`}
                    className="active:bg-surface-2 flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="relative">
                      <FramedAvatar name={u.name} avatarUrl={u.avatarUrl} frame={u.frame} className="size-11 text-sm" />
                      <span className="bg-surface absolute -right-1 -bottom-1 rounded-full text-base leading-none">
                        {r.emoji}
                      </span>
                    </span>
                    <span className="text-sm font-semibold">{u.name}</span>
                  </Link>
                </li>
              )),
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </article>
  );
}
