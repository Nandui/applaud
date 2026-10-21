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
import { Sparkles, Lock, MessageCircle, SmilePlus, Send } from "lucide-react";
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
import { ValueChip, tint } from "@/components/value-chip";
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
import { pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
};

/** The one-tap reaction — this is an applause app, after all. */
const QUICK_EMOJI = REACTION_EMOJIS[0];

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
          <Link href={`/profile/${r.id}`} className="font-semibold">
            {r.name}
          </Link>
        </Fragment>
      ))}
    </>
  );
}

/** Overlapping avatar stack for the recipients on a text-only "kudos" card. */
function AvatarStack({ people }: { people: FeedCard["recipients"] }) {
  const shown = people.slice(0, 3);
  return (
    <div className="flex -space-x-3">
      {shown.map((p) => (
        <Link
          key={p.id}
          href={`/profile/${p.id}`}
          className="ring-brand rounded-full p-[2.5px]"
        >
          <span className="bg-surface block rounded-full p-[2px]">
            <UserAvatar
              name={p.name}
              avatarUrl={p.avatarUrl}
              className="size-16 text-base"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Swipeable, snap-scrolling photo carousel with page dots (Instagram). Taps
 * are left to the parent's double-tap-to-applaud handler.
 */
function Carousel({ urls }: { urls: string[] }) {
  const [page, setPage] = useState(0);
  if (urls.length === 1) {
    return (
      <div className="bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt="Recognition attachment"
          loading="lazy"
          className="max-h-[75svh] w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setPage(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {urls.map((url, i) => (
          <div key={url} className="bg-secondary w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Recognition attachment ${i + 1} of ${urls.length}`}
              loading="lazy"
              className="aspect-[4/5] w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>
      <span
        data-numeric
        className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white"
      >
        {page + 1}/{urls.length}
      </span>
      <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1">
        {urls.map((url, i) => (
          <span
            key={url}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i === page ? "bg-white" : "bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
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
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
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

  /** The big applause button: claps, or takes back whatever I reacted with. */
  function quickReact() {
    if (!myReaction) setBurst((b) => b + 1);
    react(myReaction ?? QUICK_EMOJI);
  }

  /** Double-tap the post to applaud (never un-applauds, like Instagram). */
  function onMediaTap() {
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
  // "Liked by X and N others": lead with someone other than me when possible.
  const allReactors = sortedReactions.flatMap((r) => r.users);
  const leadReactor =
    allReactors.find((u) => u.id !== viewer.id) ?? allReactors[0] ?? null;

  const lastComment = comments.at(-1);
  const hasImages = card.imageUrls.length > 0;
  const accent = card.value?.color ?? null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
      className="bg-surface text-card-foreground -mx-4 md:mx-0 md:overflow-hidden md:rounded-2xl md:border md:shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {card.system ? (
          <span className="bg-brand flex size-9 shrink-0 items-center justify-center rounded-full text-white">
            <Sparkles className="size-4.5" />
          </span>
        ) : (
          <Link href={`/profile/${card.sender.id}`} className="shrink-0">
            <UserAvatar
              name={card.sender.name}
              avatarUrl={card.sender.avatarUrl}
              className="size-9"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1 text-[0.9rem] leading-tight">
          <p className="truncate">
            {card.system ? (
              <span className="font-semibold">{card.sender.name}</span>
            ) : (
              <Link href={`/profile/${card.sender.id}`} className="font-semibold">
                {card.sender.name}
              </Link>
            )}
            <span className="text-muted"> · </span>
            <time className="text-muted" title={card.createdAtFull}>
              {card.createdAtLabel}
            </time>
          </p>
          <p className="text-muted mt-0.5 truncate text-[0.8rem]">
            {card.visibility === "private" && (
              <Lock className="mr-1 inline size-3 align-[-1px]" aria-label="Private" />
            )}
            recognised <RecipientNames recipients={card.recipients} />
          </p>
        </div>
      </div>

      {/* Body: photos, or a big "kudos card" for text-only posts. Double-tap applauds. */}
      <div className="relative select-none" onClick={onMediaTap}>
        {hasImages ? (
          <Carousel urls={card.imageUrls} />
        ) : (
          <div
            className={cn(
              "relative flex min-h-[16rem] flex-col items-center justify-center gap-4 overflow-hidden px-7 pt-10 pb-8 text-center",
              card.system && "bg-brand text-white",
            )}
            style={
              card.system
                ? undefined
                : {
                    backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${tint(accent, 0.32) ?? "rgb(109 94 252 / 0.22)"}, transparent 65%), radial-gradient(120% 90% at 100% 100%, ${tint(accent, 0.2) ?? "rgb(217 70 239 / 0.16)"}, transparent 65%)`,
                  }
            }
          >
            <AvatarStack people={card.recipients} />
            {card.value && (
              <ValueChip
                value={card.value}
                className="bg-surface/90! -mt-1 shadow-sm backdrop-blur"
              />
            )}
            <p
              className={cn(
                "font-display max-w-md text-[1.35rem] leading-snug font-semibold tracking-tight text-balance whitespace-pre-line",
                card.system ? "text-white" : "text-foreground",
              )}
            >
              {card.message}
            </p>
          </div>
        )}

        {/* Points earned — a badge on the media, like a sticker. */}
        {card.pointsEach > 0 && (
          <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
            <span
              data-numeric
              className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"
            >
              +{pts(effectivePoints)}
            </span>
            {activeBoost && (
              <span className="bg-brand inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white">
                <span aria-hidden>{activeBoost.emoji}</span>
                {activeBoost.label} <span data-numeric>{activeBoost.multiplier}×</span>
              </span>
            )}
          </div>
        )}

        {/* Applause burst on double-tap / clap */}
        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              aria-hidden
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.25, 1], opacity: [0, 1, 1] }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.45 }}
              onAnimationComplete={() =>
                setTimeout(() => setBurst((b) => (b === burst ? 0 : b)), 250)
              }
              className="pointer-events-none absolute inset-0 m-auto flex size-28 items-center justify-center text-[5.5rem] drop-shadow-xl"
            >
              {myReaction ?? QUICK_EMOJI}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <motion.button
          type="button"
          onClick={quickReact}
          whileTap={{ scale: 0.8 }}
          aria-label={myReaction ? `Remove your ${myReaction}` : "Applaud"}
          aria-pressed={!!myReaction}
          className="flex size-11 items-center justify-center text-[1.6rem] leading-none"
        >
          <motion.span
            key={myReaction ?? "none"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 15 }}
            className={cn(!myReaction && "opacity-60 grayscale")}
          >
            {myReaction ?? QUICK_EMOJI}
          </motion.span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => openComments(true)}
          whileTap={{ scale: 0.85 }}
          aria-label="Comment"
          className="flex size-11 items-center justify-center"
        >
          <MessageCircle className="size-6.5 -scale-x-100" strokeWidth={1.8} />
        </motion.button>
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              aria-label="More reactions"
              className="flex size-11 items-center justify-center"
            >
              <SmilePlus className="size-6.5" strokeWidth={1.8} />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-full p-1.5 shadow-xl" align="start">
            <div className="flex gap-0.5">
              {REACTION_EMOJIS.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => pickReaction(emoji)}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 22 }}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  aria-label={`React ${emoji}`}
                  className={cn(
                    "rounded-full p-1.5 text-[1.75rem] leading-none",
                    myReaction === emoji && "bg-primary/10",
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
              "ml-auto mr-2 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-50",
              boostMode === "remove"
                ? "bg-secondary text-foreground"
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

      <div className="space-y-1 px-4 pb-4 text-[0.9rem] leading-snug">
        {/* Who applauded */}
        {totalReactions > 0 && leadReactor && (
          <button
            type="button"
            onClick={() => setReactorsOpen(true)}
            className="flex items-center gap-2 text-left"
          >
            <span className="flex -space-x-1 text-sm leading-none">
              {sortedReactions.slice(0, 3).map((r) => (
                <span key={r.emoji} className="bg-surface rounded-full">
                  {r.emoji}
                </span>
              ))}
            </span>
            <span>
              {totalReactions === 1 ? (
                <>
                  <span className="font-semibold">{leadReactor.name}</span> reacted
                </>
              ) : (
                <>
                  <span className="font-semibold">{leadReactor.name}</span> and{" "}
                  <span className="font-semibold" data-numeric>
                    {totalReactions - 1}
                  </span>{" "}
                  {totalReactions - 1 === 1 ? "other" : "others"}
                </>
              )}
            </span>
          </button>
        )}

        {/* Caption — photo posts carry the message under the media. */}
        {hasImages && card.message && (
          <p className="whitespace-pre-line">
            <span className="font-semibold">{card.sender.name}</span> {card.message}
          </p>
        )}
        {hasImages && card.value && <ValueChip value={card.value} className="mt-1" />}

        {comments.length > 1 && (
          <button
            type="button"
            onClick={() => openComments()}
            className="text-muted block"
          >
            View all <span data-numeric>{comments.length}</span> comments
          </button>
        )}
        {lastComment && (
          <button
            type="button"
            onClick={() => openComments()}
            className="block w-full truncate text-left"
          >
            <span className="font-semibold">{lastComment.user.name}</span>{" "}
            {lastComment.body}
          </button>
        )}
        <button
          type="button"
          onClick={() => openComments(true)}
          className="text-muted flex w-full items-center gap-2 pt-1.5 text-left"
        >
          <UserAvatar
            name={viewer.name}
            avatarUrl={viewer.avatarUrl}
            className="size-6 text-[0.55rem]"
          />
          Add a comment…
        </button>
      </div>

      {/* Comments sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3 text-center">
            <SheetTitle className="text-center text-base">Comments</SheetTitle>
            <SheetDescription className="sr-only">
              Comments on {card.sender.name}&apos;s recognition
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[55svh] min-h-[30svh] space-y-4 overflow-y-auto px-4 py-4">
            {comments.length === 0 ? (
              <div className="text-muted flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-foreground font-display text-lg font-semibold">
                  No comments yet
                </p>
                <p className="text-sm">Start the conversation.</p>
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
                    <p>
                      <Link href={`/profile/${c.user.id}`} className="font-semibold">
                        {c.user.name}
                      </Link>{" "}
                      <span className="text-muted text-xs">{c.createdAtLabel}</span>
                    </p>
                    <p className="leading-snug break-words whitespace-pre-line">
                      {c.body}
                    </p>
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
          {/* Quick emoji row + composer pinned to the bottom, like Instagram. */}
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
              <div className="focus-within:border-foreground/30 flex flex-1 items-center rounded-full border pl-4">
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
                  className="bg-primary disabled:bg-muted/30 mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors"
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
              People who reacted to this recognition
            </SheetDescription>
          </SheetHeader>
          <ul className="max-h-[60svh] overflow-y-auto py-2">
            {sortedReactions.flatMap((r) =>
              r.users.map((u) => (
                <li key={`${r.emoji}-${u.id}`}>
                  <Link
                    href={`/profile/${u.id}`}
                    className="active:bg-secondary flex items-center gap-3 px-4 py-2.5"
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
