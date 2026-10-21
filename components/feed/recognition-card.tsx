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
import { UserAvatar } from "@/components/user-avatar";
import { ValueChip } from "@/components/value-chip";
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
};

/** The one-tap reaction — this is an applause app, after all. */
const QUICK_EMOJI = REACTION_EMOJIS[0];
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

/** "→ Cian, Saoirse" — who the shout-out is for, as tappable pills. */
function RecipientPills({ recipients }: { recipients: FeedCard["recipients"] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-muted text-xs font-semibold">to</span>
      {recipients.map((r) => (
        <Link
          key={r.id}
          href={`/profile/${r.id}`}
          className="bg-surface-2 hover:bg-surface-3 inline-flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-0.5 text-[0.8rem] font-semibold transition-colors"
        >
          <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="size-6 text-[0.5rem]" />
          {r.name}
        </Link>
      ))}
    </div>
  );
}

/**
 * Horizontally scrolling media row (the Threads attachment strip). A single
 * image goes full width; several become a swipeable row of tall tiles.
 */
function MediaRow({ urls }: { urls: string[] }) {
  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt="Shout-out attachment"
        loading="lazy"
        draggable={false}
        className="border-border mt-3 max-h-[28rem] w-full rounded-2xl border object-cover"
      />
    );
  }
  return (
    <div className="no-scrollbar -mr-4 mt-3 flex snap-x gap-2 overflow-x-auto pr-4">
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={`Attachment ${i + 1} of ${urls.length}`}
          loading="lazy"
          draggable={false}
          className="border-border aspect-[4/5] w-[62%] shrink-0 snap-start rounded-2xl border object-cover"
        />
      ))}
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

  /** Double-tap the post to applaud (never un-applauds, like Instagram). */
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
  const facePile = [...new Map(allReactors.map((u) => [u.id, u])).values()].slice(0, 3);

  const canPin =
    pinned !== undefined && !card.system && card.recipients.some((r) => r.id === viewer.id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.18) }}
      className="border-border flex gap-3 border-b px-0.5 pt-4 pb-3"
    >
      {/* Left rail: author avatar + thread line + reactor face-pile (Threads). */}
      <div className="flex w-10 shrink-0 flex-col items-center">
        {card.system ? (
          <span className="bg-brand flex size-10 items-center justify-center rounded-full text-white">
            <Sparkles className="size-5" />
          </span>
        ) : (
          <Link href={`/profile/${card.sender.id}`}>
            <UserAvatar
              name={card.sender.name}
              avatarUrl={card.sender.avatarUrl}
              className="size-10"
            />
          </Link>
        )}
        <span className="bg-border my-2 w-0.5 flex-1 rounded-full" />
        {facePile.length > 0 && (
          <button
            type="button"
            onClick={() => setReactorsOpen(true)}
            aria-label="See who reacted"
            className="relative h-6 w-8"
          >
            {facePile.map((u, i) => (
              <UserAvatar
                key={u.id}
                name={u.name}
                avatarUrl={u.avatarUrl}
                className={cn(
                  "ring-background absolute size-[1.15rem] text-[0.4rem] ring-2",
                  i === 0 && "top-0 left-1",
                  i === 1 && "top-2 left-3.5",
                  i === 2 && "top-0 left-4.5",
                )}
              />
            ))}
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-1.5 text-[0.95rem] leading-tight">
          {card.system ? (
            <span className="truncate font-semibold">{card.sender.name}</span>
          ) : (
            <Link href={`/profile/${card.sender.id}`} className="truncate font-semibold">
              {card.sender.name}
            </Link>
          )}
          <time className="text-muted shrink-0 text-sm" title={card.createdAtFull}>
            {card.createdAtLabel}
          </time>
          {card.visibility === "private" && (
            <Lock className="text-muted size-3.5 shrink-0" aria-label="Private" />
          )}
          {canPin && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="More"
                  className="text-muted hover:bg-surface-2 -my-2 -mr-2 ml-auto flex size-9 shrink-0 items-center justify-center rounded-full"
                >
                  {pinned ? <Pin className="text-lime-ink size-4 fill-current" /> : <Ellipsis className="size-5" />}
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
        </div>

        {card.recipients.length > 0 && <RecipientPills recipients={card.recipients} />}

        {/* Body. Double-tap applauds. */}
        <div className="relative mt-2 select-none" onClick={onBodyTap}>
          <p
            className={cn(
              "text-[0.98rem] leading-relaxed break-words whitespace-pre-line",
              card.system &&
                "bg-brand rounded-2xl px-4 py-5 font-display text-xl leading-snug font-semibold text-white",
            )}
          >
            {card.message}
          </p>
          {card.imageUrls.length > 0 && <MediaRow urls={card.imageUrls} />}

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
                className="pointer-events-none absolute inset-0 m-auto flex size-24 items-center justify-center text-7xl drop-shadow-xl"
              >
                {myReaction ?? QUICK_EMOJI}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Tags: value, points, boost */}
        {(card.value || card.pointsEach > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {card.value && <ValueChip value={card.value} />}
            {card.pointsEach > 0 && (
              <span
                data-numeric
                className="bg-lime text-lime-fg inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold"
              >
                +{pts(effectivePoints)}
              </span>
            )}
            {activeBoost && (
              <span className="bg-brand inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-white">
                <span aria-hidden>{activeBoost.emoji}</span>
                {activeBoost.label} <span data-numeric>{activeBoost.multiplier}×</span>
              </span>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="-ml-2.5 mt-1.5 flex items-center">
          <motion.button
            type="button"
            onClick={quickReact}
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onContextMenu={(e) => e.preventDefault()}
            whileTap={{ scale: 0.82 }}
            aria-label={myReaction ? `Remove your ${myReaction}` : "Applaud (hold for more)"}
            aria-pressed={!!myReaction}
            className="flex h-10 items-center gap-1 rounded-full px-2.5"
          >
            <motion.span
              key={myReaction ?? "none"}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 600, damping: 14 }}
              className={cn(
                "text-[1.3rem] leading-none",
                !myReaction && "opacity-70 grayscale",
              )}
            >
              {myReaction ?? QUICK_EMOJI}
            </motion.span>
            {totalReactions > 0 && (
              <span
                data-numeric
                className={cn(
                  "text-sm font-semibold",
                  myReaction ? "text-foreground" : "text-muted",
                )}
              >
                {formatNumber(totalReactions)}
              </span>
            )}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => openComments(true)}
            whileTap={{ scale: 0.85 }}
            aria-label="Comment"
            className="text-muted flex h-10 items-center gap-1 rounded-full px-2.5"
          >
            <MessageCircle className="size-5.5 -scale-x-100" strokeWidth={1.9} />
            {comments.length > 0 && (
              <span data-numeric className="text-sm font-semibold">
                {formatNumber(comments.length)}
              </span>
            )}
          </motion.button>

          {/* Tray anchors here; holding the applaud button opens it too. */}
          <Popover open={reactOpen} onOpenChange={setReactOpen}>
            <PopoverTrigger asChild>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                aria-label="Pick a reaction"
                className="text-muted flex size-10 items-center justify-center rounded-full"
              >
                <SmilePlus className="size-5.5" strokeWidth={1.9} />
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
                boostMode === "remove"
                  ? "bg-surface-2 text-foreground"
                  : "bg-brand text-white",
              )}
            >
              <span aria-hidden>{BOOSTS[myBoostType].emoji}</span>
              {boostMode === "remove"
                ? "Remove boost"
                : `Boost ${BOOSTS[myBoostType].multiplier}×`}
            </motion.button>
          )}
        </div>

        {/* Footer: "Sorcha and 3 others · 2 replies" */}
        {(totalReactions > 0 || comments.length > 0) && (
          <p className="text-muted -mt-0.5 text-sm">
            {totalReactions > 0 && leadReactor && (
              <button type="button" onClick={() => setReactorsOpen(true)} className="hover:underline">
                {sortedReactions.slice(0, 3).map((r) => (
                  <Fragment key={r.emoji}>{r.emoji}</Fragment>
                ))}{" "}
                <span className="text-foreground font-medium">{leadReactor.name.split(" ")[0]}</span>
                {totalReactions > 1 && (
                  <>
                    {" "}and <span data-numeric>{totalReactions - 1}</span>{" "}
                    {totalReactions - 1 === 1 ? "other" : "others"}
                  </>
                )}
              </button>
            )}
            {totalReactions > 0 && comments.length > 0 && " · "}
            {comments.length > 0 && (
              <button type="button" onClick={() => openComments()} className="hover:underline">
                <span data-numeric>{comments.length}</span>{" "}
                {comments.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </p>
        )}
      </div>

      {/* Comments sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3 text-center">
            <SheetTitle className="text-center text-base">Replies</SheetTitle>
            <SheetDescription className="sr-only">
              Replies to {card.sender.name}&apos;s shout-out
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[55svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 py-4">
            {comments.length === 0 ? (
              <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-foreground font-display text-lg font-semibold">
                  No replies yet
                </p>
                <p className="text-sm">Hype them up 🙌</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <Link href={`/profile/${c.user.id}`} className="shrink-0">
                    <UserAvatar
                      name={c.user.name}
                      avatarUrl={c.user.avatarUrl}
                      className="size-8"
                    />
                  </Link>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="bg-surface-2 inline-block max-w-full rounded-2xl rounded-tl-md px-3.5 py-2">
                      <Link href={`/profile/${c.user.id}`} className="block text-[0.8rem] font-semibold">
                        {c.user.name}
                      </Link>
                      <p className="leading-snug break-words whitespace-pre-line">{c.body}</p>
                    </div>
                    <p className="text-muted mt-1 flex gap-3 px-1 text-xs">
                      <span>{c.createdAtLabel}</span>
                      <button
                        type="button"
                        onClick={() => replyTo(c.user.name)}
                        className="font-semibold"
                      >
                        Reply
                      </button>
                    </p>
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
              <UserAvatar
                name={viewer.name}
                avatarUrl={viewer.avatarUrl}
                className="size-9 shrink-0"
              />
              <div className="bg-surface-2 focus-within:ring-primary/40 flex flex-1 items-center rounded-full pl-4 focus-within:ring-2">
                <input
                  ref={commentInputRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Reply to ${card.recipients[0]?.name.split(" ")[0] ?? "them"}…`}
                  maxLength={500}
                  enterKeyHint="send"
                  className="placeholder:text-muted h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!body.trim()}
                  aria-label="Post reply"
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
                      <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="size-11" />
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
