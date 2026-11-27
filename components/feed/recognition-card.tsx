"use client";

import {
  Fragment,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageCircle,
  SmilePlus,
  Ellipsis,
  Pin,
  PinOff,
  Trash2,
  Clock,
  BarChart3,
  MessageCircleQuestion,
  MapPin,
  LifeBuoy,
} from "lucide-react";
import { toast } from "sonner";
import { toggleReaction, toggleBoost, deletePost } from "@/lib/recognition/actions";
import { togglePin } from "@/lib/profile-actions";
import { unpinFromFeed } from "@/lib/recognition/feed-pin-actions";
import { PinToFeedSheet } from "@/components/feed/pin-to-feed-sheet";
import { TypingLine } from "@/components/feed/live-comments";
import { CommentsSheet, useCardComments } from "@/components/feed/comments";
import {
  REACTION_EMOJIS,
  BOOSTS,
  boostForRole,
  boostMultiplier,
  type BoostType,
} from "@/lib/config";
import type { FeedCard } from "@/lib/recognition/queries";
import { ServiceMedal } from "@/components/service-medal";
import { FramedAvatar } from "@/components/user-avatar";
import { DEFAULT_LOOK } from "@/lib/cosmetics";
import { isLight } from "@/lib/contrast";
import { optimizedImage } from "@/lib/image-url";
import { fallBackTo, isGiphyMediaUrl } from "@/lib/recognition/gif";
import { ValueSeal } from "@/components/value-seal";
import { PostBanner } from "@/components/feed/post-banner";
import { PollChoices } from "@/components/feed/poll";
import { QuestionAnswers } from "@/components/feed/question";
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
import { coveredPhrase } from "@/lib/covers";
import { cn } from "@/lib/utils";

type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  /** The viewer's equipped frame, for their own optimistic comments. */
  frame?: string | null;
  /** Manager rank and above, or an admin: may pin things to the top of the feed. */
  canPinToFeed?: boolean;
};

/** Messages longer than this also appear in full as a caption under the quote card. */
const QUOTE_MAX = 160;

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
function BannerHero({ card, onMore }: { card: FeedCard; onMore: () => void }) {
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMore();
          }}
          data-numeric
          className="relative -mt-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold"
        >
          +{formatNumber(extra)} more
        </button>
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

/** A small service medal after someone's name, from one year on. */
function NameMedal({ months }: { months: number | null }) {
  if (!months) return null;
  return <ServiceMedal months={months} size={18} className="ml-1 -translate-y-px" />;
}

/** The feed column is at most 576px wide; photos are resized to fit it. */
const MEDIA_WIDTH = 600;

/**
 * Photos and GIFs full width, swipeable when there are several (Instagram
 * carousel). Photos are cropped to fill the frame; GIFs are never cut, so they
 * are fitted whole inside it on a plain backdrop.
 */
function MediaHero({ urls }: { urls: string[] }) {
  const [at, setAt] = useState(0);
  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimizedImage(urls[0], MEDIA_WIDTH)}
        onError={fallBackTo(urls[0])}
        alt="Recognition photo"
        loading="lazy"
        decoding="async"
        draggable={false}
        className={
          isGiphyMediaUrl(urls[0])
            ? "bg-surface-2 max-h-[36rem] w-full object-contain"
            : "max-h-[36rem] min-h-64 w-full object-cover"
        }
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
            onError={fallBackTo(url)}
            alt={`Photo ${i + 1} of ${urls.length}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={cn(
              "aspect-[4/5] w-full shrink-0 snap-center",
              isGiphyMediaUrl(url) ? "bg-surface-2 object-contain" : "object-cover",
            )}
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
  showFeedPin = false,
}: {
  card: FeedCard;
  viewer: Viewer;
  index?: number;
  /** Show the "Pinned" marker above the card (the Home feed's pinned row). */
  showFeedPin?: boolean;
  /**
   * Whether this shout-out is pinned to the viewer's profile. Only meaningful
   * (and the pin menu only shown) when the viewer is one of the recipients.
   */
  pinned?: boolean;
}) {
  const [, startReaction] = useTransition();
  const [boostPending, startBoost] = useTransition();
  const [pinPending, startPin] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [feedPinPending, startFeedPin] = useTransition();
  const [burst, setBurst] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Optimistic state so claps and comments land instantly, then reconcile with
  // the server's revalidated data — the snappy feel of a social app.
  const [reactions, applyReaction] = useOptimistic(
    card.reactions,
    (state: FeedCard["reactions"], emoji: string) =>
      switchReaction(state, emoji, viewer),
  );
  // Comments, replies and their reactions, live while you watch.
  const commentState = useCardComments({ card, viewer, open: commentsOpen });
  const { comments, typing, watchRef } = commentState;

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

  function pickReaction(emoji: string) {
    // Picking the emoji you already gave takes it back.
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

  function onUnpinFromFeed() {
    setMenuOpen(false);
    startFeedPin(async () => {
      const res = await unpinFromFeed(card.id);
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
  if (myBoostType && card.pointsEach > 0 && card.kind === "recognition") {
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

  // Posts, polls and questions are written by one person (no recipients).
  const isPost = card.kind === "post" || card.kind === "poll" || card.kind === "question";
  // Thanks for covering at short notice: recipients like a shout-out, no value.
  const isCover = card.kind === "cover" && card.cover !== null;
  const isPoll = card.kind === "poll" && card.poll !== null;
  const isQuestion = card.kind === "question" && card.question !== null;
  const isMine = card.sender.id === viewer.id;
  const noun = card.kind === "recognition" ? "recognition" : card.kind;
  const canPin =
    pinned !== undefined && !card.system && card.recipients.some((r) => r.id === viewer.id);
  // Posts can be deleted by whoever wrote them, and by admins (moderation).
  const canDelete = isPost && (card.sender.id === viewer.id || viewer.role === "admin");
  // Pinning to the top of the Home feed: managers and above, and admins. Only
  // whoever pinned it (or an admin) can unpin it or change the time.
  const feedPin = card.feedPin;
  const canFeedPin = Boolean(viewer.canPinToFeed);
  const canChangeFeedPin =
    feedPin !== null && (viewer.role === "admin" || (feedPin.byId !== null && feedPin.byId === viewer.id));
  const showFeedPinMenu = canFeedPin;

  // A big group (a whole site, or everyone) reads "Aoife, Cian & 40 others",
  // with the viewer first when they're in it; the rest open in a sheet.
  const recipients = card.recipients.some((r) => r.id === viewer.id)
    ? [...card.recipients.filter((r) => r.id === viewer.id), ...card.recipients.filter((r) => r.id !== viewer.id)]
    : card.recipients;
  const bigGroup = recipients.length > 4;
  const people = recipients.slice(0, 3);
  const accent = card.recipients[0]?.look.theme ?? DEFAULT_LOOK.theme;
  const hasMedia = card.imageUrls.length > 0;
  // Who the post is about: the recipients of a shout-out, the author of a post.
  // Under the post: the last two comments, not replies (those need the sheet).
  const previewComments = comments.filter((c) => !c.parentId).slice(-2);

  if (deleted) return null;

  return (
    <article
      className="card-in pt-3 pb-6"
      style={{ "--card": Math.min(index, 6) } as React.CSSProperties}
    >
      {showFeedPin && feedPin && (
        <p className="text-primary mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold">
          <Pin className="size-3.5 fill-current" aria-hidden />
          <span className="truncate">
            Pinned{feedPin.byName ? ` by ${feedPin.byName}` : ""}
            <span className="text-muted font-normal"> · {feedPin.untilLabel}</span>
          </span>
        </p>
      )}
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
            {recipients.length > 3 && (
              <button
                type="button"
                onClick={() => setPeopleOpen(true)}
                aria-label={`See all ${recipients.length} people`}
                data-numeric
                className="bg-surface-2 border-background relative z-10 -ml-4 flex size-11 items-center justify-center rounded-full border-2 text-xs font-bold"
              >
                +{formatNumber(recipients.length - 3)}
              </button>
            )}
          </div>
        ) : (
          <span className="bg-brand flex size-11 shrink-0 items-center justify-center rounded-full text-white">
            <Sparkles className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[1.05rem] font-bold tracking-tight">
            {isPost ? (
              <>
                <Link href={`/profile/${card.sender.id}`}>{card.sender.name}</Link>
                <NameMedal months={card.sender.serviceMonths} />
              </>
            ) : bigGroup ? (
              <>
                <Link href={`/profile/${recipients[0].id}`}>{recipients[0].name.split(" ")[0]}</Link>
                {" & "}
                <button type="button" onClick={() => setPeopleOpen(true)} className="font-bold">
                  <span data-numeric>{formatNumber(recipients.length - 1)}</span> others
                </button>
              </>
            ) : (
              recipients.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && (i === recipients.length - 1 ? " & " : ", ")}
                  <Link href={`/profile/${r.id}`}>{r.name}</Link>
                  <NameMedal months={r.serviceMonths} />
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
                {isCover ? "thanked by" : "recognised by"}
                <Link href={`/profile/${card.sender.id}`} className="text-foreground font-semibold">
                  {card.sender.name}
                </Link>
              </>
            )}
            <time title={card.createdAtFull}>
              {isPost && !card.sender.jobTitle ? "" : "· "}
              {card.createdAtLabel}
            </time>
            {card.audienceLabel && (
              <span className="flex shrink-0 items-center gap-0.5">
                · <MapPin className="size-3.5" />
                {card.audienceLabel}
              </span>
            )}
          </p>
        </div>
        {(canPin || canDelete || showFeedPinMenu) && (
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
            <PopoverContent align="end" className="w-60 rounded-2xl p-1.5">
              {showFeedPinMenu && !feedPin && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setPinSheetOpen(true);
                  }}
                  className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                >
                  <Pin className="size-4.5" />
                  Pin to top of feed
                </button>
              )}
              {showFeedPinMenu && feedPin && canChangeFeedPin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setPinSheetOpen(true);
                    }}
                    className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                  >
                    <Clock className="size-4.5" />
                    Change pin time
                  </button>
                  <button
                    type="button"
                    onClick={onUnpinFromFeed}
                    disabled={feedPinPending}
                    className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    <PinOff className="size-4.5" />
                    Unpin from feed
                  </button>
                </>
              )}
              {showFeedPinMenu && feedPin && !canChangeFeedPin && (
                <p className="text-muted flex items-start gap-3 px-3 py-2.5 text-[0.82rem] leading-snug">
                  <Pin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Pinned by {feedPin.byName ?? "someone"}. Only they or an admin can unpin it.
                  </span>
                </p>
              )}
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
                  {confirmDelete ? "Tap again to delete" : `Delete ${noun}`}
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </header>

      {/* The picture: their photo/GIF, or the recipient's own banner and frame. */}
      <div
        className={cn(
          "relative -mx-4 mt-3 overflow-hidden select-none md:mx-0",
          // Posts have no "Recognised for" band underneath to round off.
          isPost ? "md:rounded-2xl" : "md:rounded-t-2xl",
        )}
      >
        {isPoll || isQuestion ? (
          <PostBanner
            banner={card.sender.look.banner}
            message={card.message}
            className="aspect-[2/1] min-h-44 py-6"
            label={
              isPoll ? (
                <>
                  <BarChart3 className="size-3.5" /> Poll
                </>
              ) : (
                <>
                  <MessageCircleQuestion className="size-3.5" /> Question
                </>
              )
            }
          />
        ) : hasMedia ? (
          <MediaHero urls={card.imageUrls} />
        ) : isPost ? (
          <PostBanner banner={card.sender.look.banner} message={card.message} />
        ) : (
          <BannerHero card={card} onMore={() => setPeopleOpen(true)} />
        )}

        {/* Burst of the emoji you just reacted with */}
        {burst > 0 && myReaction && (
          <span
            key={burst}
            aria-hidden
            onAnimationEnd={() => setBurst((b) => (b === burst ? 0 : b))}
            className="like-burst pointer-events-none absolute inset-0 m-auto flex size-28 items-center justify-center text-8xl drop-shadow-xl"
          >
            {myReaction}
          </span>
        )}
      </div>

      {isPoll && card.poll && (
        <PollChoices pollId={card.id} poll={card.poll} isAsker={isMine} askerName={card.sender.name} />
      )}
      {isQuestion && card.question && (
        <QuestionAnswers
          questionId={card.id}
          question={card.question}
          isAsker={isMine}
          askerName={card.sender.name}
        />
      )}

      {/* Covers: what they stepped in for, with the points. */}
      {isCover && card.cover && (
        <div
          className="-mx-4 flex items-center gap-3 px-4 py-2.5 md:mx-0 md:rounded-b-2xl"
          style={{ backgroundColor: tint("#0d9488", 0.14) ?? "var(--surface)" }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white shadow-sm">
            <LifeBuoy className="size-5.5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-muted text-[0.7rem] font-semibold tracking-wider uppercase">
              {coveredPhrase(card.cover.type)} · last minute
            </p>
            <p className="truncate text-[1.05rem] font-extrabold text-[#0f766e] dark:text-[#5eead4]">
              {card.cover.what}
            </p>
          </div>
          {card.pointsEach > 0 && (
            <span
              data-numeric
              className="flex shrink-0 items-center gap-1 rounded-full bg-[#0d9488] px-3 py-1.5 text-sm font-bold text-white"
            >
              +{pts(card.pointsEach)}
            </span>
          )}
        </div>
      )}

      {/* What it's for: the value's medal and name, with the points earned. */}
      {!isCover && (card.value || card.pointsEach > 0) && (
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
              {card.recipients.length > 1 && " each"}
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
      <div data-tour="post-actions" className="-ml-2.5 mt-1 flex items-center">
        {/* The one reaction control: tap to pick an emoji, pick yours again to take it back. */}
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={myReaction ? `Your reaction ${myReaction}, tap to change` : "React"}
              aria-pressed={!!myReaction}
              className="press flex size-11 items-center justify-center rounded-full"
            >
              <span key={myReaction ?? "none"} className="like-pop text-[1.5rem] leading-none">
                {myReaction ?? <SmilePlus className="size-6.5" strokeWidth={1.8} />}
              </span>
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
                  aria-label={myReaction === emoji ? `Remove your ${emoji}` : `React ${emoji}`}
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

        {!isQuestion && (
        <button
          type="button"
          onClick={() => openComments(true)}
          aria-label={comments.length > 0 ? `Comments (${comments.length})` : "Comment"}
          className={cn(
            "press flex h-11 items-center justify-center gap-1 rounded-full",
            comments.length > 0 ? "px-2" : "w-11",
          )}
        >
          <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
          {comments.length > 0 && (
            <span data-numeric className="text-sm font-semibold">
              {formatNumber(comments.length)}
            </span>
          )}
        </button>
        )}


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

      {/* "👏❤️ Sorcha and 3 others" */}
      {totalReactions > 0 && leadReactor && (
        <button
          type="button"
          onClick={() => setReactorsOpen(true)}
          className="block text-left text-[0.9rem]"
        >
          {sortedReactions.slice(0, 3).map((r) => (
            <Fragment key={r.emoji}>{r.emoji}</Fragment>
          ))}{" "}
          <span className="font-semibold">{leadReactor.name}</span>
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

      {comments.length > previewComments.length && (
        <button type="button" onClick={() => openComments()} className="text-muted mt-1 block text-[0.9rem]">
          {comments.length === 1
            ? "View 1 comment"
            : `View all ${formatNumber(comments.length)} comments`}
        </button>
      )}
      <span ref={watchRef} aria-hidden className="block" />
      {previewComments.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => openComments()}
          className="mt-0.5 block w-full truncate text-left text-[0.9rem]"
        >
          <span className="mr-1.5 font-semibold">{c.user.name}</span>
          {c.body || (c.gifUrl && <span className="text-muted">sent a GIF</span>)}
        </button>
      ))}
      {!commentsOpen && <TypingLine users={typing} className="mt-1" />}

      {canFeedPin && (
        <PinToFeedSheet
          open={pinSheetOpen}
          onOpenChange={setPinSheetOpen}
          recognitionId={card.id}
          noun={noun}
          changing={feedPin !== null}
        />
      )}
      <CommentsSheet
        state={commentState}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        viewer={viewer}
        description={`Comments on ${card.sender.name}'s ${noun}`}
        emptyHint={isPost ? "Start the conversation 💬" : "Be the first to hype them up 🙌"}
        inputRef={commentInputRef}
      />

      {/* Who reacted sheet */}
      <Sheet open={reactorsOpen} onOpenChange={setReactorsOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3">
            <SheetTitle className="text-center text-base">Reactions</SheetTitle>
            <SheetDescription className="sr-only">
              People who reacted to this {noun}
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

      {/* Everyone a group recognition went to. */}
      <Sheet open={peopleOpen} onOpenChange={setPeopleOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3">
            <SheetTitle className="text-center text-base">
              {isCover ? "Thanked" : "Recognised"} · <span data-numeric>{formatNumber(recipients.length)}</span> people
            </SheetTitle>
            <SheetDescription className="sr-only">Everyone this {noun} went to</SheetDescription>
          </SheetHeader>
          <ul className="max-h-[60svh] overflow-y-auto py-2">
            {recipients.map((r) => (
              <li key={r.id}>
                <Link href={`/profile/${r.id}`} className="active:bg-surface-2 flex items-center gap-3 px-4 py-2.5">
                  <FramedAvatar name={r.name} avatarUrl={r.avatarUrl} frame={r.look.frame} className="size-11 text-sm" />
                  <span className="text-sm font-semibold">{r.name}</span>
                  <NameMedal months={r.serviceMonths} />
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </article>
  );
}
