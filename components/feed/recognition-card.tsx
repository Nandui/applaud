"use client";

import {
  Fragment,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
} from "lucide-react";
import { toast } from "sonner";
import { toggleReaction, addComment, toggleBoost } from "@/lib/recognition/actions";
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
import { bannerStyle, themeColour } from "@/lib/cosmetics";
import { isLight } from "@/lib/profile-custom";
import { ValueSeal } from "@/components/value-seal";
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
      style={{ background: bannerStyle(lead?.look.banner) }}
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

/** Photos and GIFs full width, swipeable when there are several (Instagram carousel). */
function MediaHero({ urls }: { urls: string[] }) {
  const [at, setAt] = useState(0);
  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt="Shout-out photo"
        loading="lazy"
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
            src={url}
            alt={`Photo ${i + 1} of ${urls.length}`}
            loading="lazy"
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
          frame: viewer.frame ?? null,
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

  const canPin =
    pinned !== undefined && !card.system && card.recipients.some((r) => r.id === viewer.id);

  const people = card.recipients.slice(0, 3);
  const accent = themeColour(card.recipients[0]?.look.theme);
  const hasMedia = card.imageUrls.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.18) }}
      className="pt-3 pb-6"
    >
      {/* Header: who it's for, big; who sent it underneath. */}
      <header className="flex items-center gap-3">
        {people.length > 0 ? (
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
            {card.recipients.map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 && (i === card.recipients.length - 1 ? " & " : ", ")}
                <Link href={`/profile/${r.id}`}>{r.name}</Link>
              </Fragment>
            ))}
          </p>
          <p className="text-muted mt-0.5 flex items-center gap-1 truncate text-[0.82rem]">
            {card.system ? (
              <span>{card.sender.name}</span>
            ) : (
              <>
                recognised by
                <Link href={`/profile/${card.sender.id}`} className="text-foreground font-semibold">
                  {card.sender.name}
                </Link>
              </>
            )}
            <time title={card.createdAtFull}>· {card.createdAtLabel}</time>
            {card.visibility === "private" && <Lock className="size-3.5 shrink-0" aria-label="Private" />}
          </p>
        </div>
        {canPin && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
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
              <button
                type="button"
                onClick={onPin}
                disabled={pinPending}
                className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
              >
                {pinned ? <PinOff className="size-4.5" /> : <Pin className="size-4.5" />}
                {pinned ? "Unpin from profile" : "Pin to profile"}
              </button>
            </PopoverContent>
          </Popover>
        )}
      </header>

      {/* The picture: their photo/GIF, or the recipient's own banner and frame.
          Double-tap applauds. */}
      <div
        className="relative -mx-4 mt-3 overflow-hidden select-none md:mx-0 md:rounded-t-2xl"
        onClick={onBodyTap}
      >
        {hasMedia ? <MediaHero urls={card.imageUrls} /> : <BannerHero card={card} />}

        {/* Applause burst on double-tap / clap */}
        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              aria-hidden
              initial={{ scale: 0.2, opacity: 0, rotate: -12 }}
              animate={{ scale: [0.2, 1.3, 1], opacity: [0, 1, 1], rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, y: -30 }}
              transition={{ duration: 0.42 }}
              onAnimationComplete={() =>
                setTimeout(() => setBurst((b) => (b === burst ? 0 : b)), 250)
              }
              className="pointer-events-none absolute inset-0 m-auto flex size-28 items-center justify-center text-8xl drop-shadow-xl"
            >
              {myReaction ?? QUICK_EMOJI}
            </motion.span>
          )}
        </AnimatePresence>
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
        <motion.button
          type="button"
          onClick={quickReact}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => e.preventDefault()}
          whileTap={{ scale: 0.82 }}
          aria-label={myReaction ? `Remove your ${myReaction}` : "Like (hold for more reactions)"}
          aria-pressed={!!myReaction}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <motion.span
            key={myReaction ?? "none"}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 14 }}
            className="text-[1.5rem] leading-none"
          >
            {!myReaction ? (
              <Heart className="size-6.5" strokeWidth={1.8} />
            ) : myReaction === QUICK_EMOJI ? (
              <Heart className="size-6.5 fill-[#ff3040] text-[#ff3040]" strokeWidth={1.8} />
            ) : (
              myReaction
            )}
          </motion.span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => openComments(true)}
          whileTap={{ scale: 0.85 }}
          aria-label="Comment"
          className="flex size-11 items-center justify-center rounded-full"
        >
          <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
        </motion.button>

        {/* Tray anchors here; holding the applaud button opens it too. */}
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              aria-label="Pick a reaction"
              className="flex size-11 items-center justify-center rounded-full"
            >
              <SmilePlus className="size-6" strokeWidth={1.8} />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-auto rounded-full p-1.5 shadow-float"
          >
            <div className="flex gap-0.5">
              {REACTION_EMOJIS.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => pickReaction(emoji)}
                  initial={{ y: 14, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 520, damping: 20 }}
                  whileHover={{ scale: 1.35, y: -6 }}
                  whileTap={{ scale: 0.85 }}
                  aria-label={`React ${emoji}`}
                  className={cn(
                    "rounded-full p-1.5 text-[1.8rem] leading-none",
                    myReaction === emoji && "bg-primary/20",
                  )}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {boostMode && myBoostType && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onBoost(myBoostType)}
            disabled={boostPending}
            className={cn(
              "ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold disabled:opacity-50",
              boostMode === "remove" ? "bg-surface-2 text-foreground" : "bg-brand text-white",
            )}
          >
            <span aria-hidden>{BOOSTS[myBoostType].emoji}</span>
            {boostMode === "remove" ? "Remove boost" : `Boost ${BOOSTS[myBoostType].multiplier}×`}
          </motion.button>
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

      {/* Comments sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3 text-center">
            <SheetTitle className="text-center text-base">Comments</SheetTitle>
            <SheetDescription className="sr-only">
              Comments on {card.sender.name}&apos;s shout-out
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[55svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 py-4">
            {comments.length === 0 ? (
              <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-foreground font-display text-lg font-semibold">
                  No comments yet
                </p>
                <p className="text-sm">Be the first to hype them up 🙌</p>
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
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Add a comment for ${card.recipients[0]?.name.split(" ")[0] ?? "them"}…`}
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
              People who reacted to this shout-out
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
    </motion.article>
  );
}
