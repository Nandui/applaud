import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Pin, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";
import { getProfileData } from "@/lib/profile";
import { getCardsByIds, getGivenCards, getReceivedCards } from "@/lib/recognition/queries";
import { DecoratedAvatar } from "@/components/user-avatar";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { BackButton } from "@/components/app-shell/back-button";
import { AccountSheet } from "@/components/app-shell/account-sheet";
import {
  AboutCard,
  Banner,
  BadgeRow,
  EmptyShowcase,
  LevelCard,
  Stats,
  StatusBubble,
  TrophyCase,
  bannerButtonClass,
  onPrimary,
  themeVars,
} from "@/components/profile/profile-parts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProfileData(id);
  return { title: data ? data.user.name : "Profile" };
}

type Tab = "received" | "given";

/**
 * Profile, Discord + Steam: themed banner and page tint, decorated avatar with
 * a status bubble, badge strip, level card, About me, pinned shout-outs, a
 * trophy case, then the person's shout-outs (Received / Given).
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "given" ? "given" : "received";
  const viewer = await requireUser();
  const data = await getProfileData(id);
  if (!data) notFound();

  const { user, custom } = data;
  const isMe = viewer.id === user.id;
  const firstName = user.name.split(" ")[0];

  const [cards, pinnedCards, allValues] = await Promise.all([
    tab === "given" ? getGivenCards(user.id, viewer.id) : getReceivedCards(user.id, viewer.id),
    getCardsByIds(custom.pinned, viewer.id),
    prisma.value.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
  ]);
  const pinnedSet = new Set(custom.pinned);
  const viewerProps = {
    id: viewer.id,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl ?? null,
    role: viewer.role,
  };

  return (
    <div
      className="relative isolate mx-auto max-w-xl"
      style={themeVars(custom)}
    >
      {/* The theme washes down the top of the page (Discord profile themes). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-0 -z-10 -mx-4 h-[34rem] opacity-30 md:-mx-8"
        style={{
          backgroundImage:
            "linear-gradient(180deg, color-mix(in srgb, var(--p1) 70%, transparent), color-mix(in srgb, var(--p2) 25%, transparent) 55%, transparent)",
        }}
      />

      <Banner>
        {isMe ? <span /> : <BackButton className={bannerButtonClass} />}
        {isMe ? <AccountSheet admin={isAdmin(viewer)} triggerClassName={bannerButtonClass} /> : null}
      </Banner>

      {/* Avatar overlapping the banner, status bubble beside it */}
      <div className="-mt-16 flex items-start gap-1">
        <DecoratedAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          decoration={custom.decoration}
          className="size-26 text-2xl"
          large
        />
        <div className="mt-16 min-w-0 pl-2">
          <StatusBubble status={custom.status} />
        </div>
      </div>

      {/* Identity */}
      <section className="mt-2 space-y-3">
        <div>
          <h1 className="font-display text-[1.85rem] leading-tight font-extrabold tracking-tight">
            {user.name}
          </h1>
          <p className="text-muted mt-0.5 text-[0.95rem]">
            {[user.jobTitle, custom.pronouns, user.site?.code].filter(Boolean).join(" · ")}
          </p>
        </div>
        <BadgeRow data={data} />
        <Stats data={data} />

        <div className="flex gap-2 pt-1">
          {isMe ? (
            <>
              <Link
                href="/profile/edit"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl font-bold transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--p1)", color: onPrimary(custom) }}
              >
                <Pencil className="size-4" /> Edit profile
              </Link>
              <Link
                href="/me"
                className="bg-surface-2 flex h-11 items-center justify-center gap-2 rounded-2xl px-5 font-bold transition-transform active:scale-[0.98]"
              >
                <Wallet className="size-4" /> Wallet
              </Link>
            </>
          ) : (
            <Link
              href={`/recognize?to=${user.id}`}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl font-bold transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "var(--p1)", color: onPrimary(custom) }}
            >
              <span aria-hidden>👏</span> Send {firstName} a shout-out
            </Link>
          )}
        </div>
      </section>

      <div className="mt-5 space-y-3">
        {(custom.bio || user.managers.length > 0 || user.site) && <AboutCard data={data} />}
        <LevelCard data={data} isMe={isMe} />

        {/* Pinned (the Steam showcase slot) */}
        {pinnedCards.length > 0 ? (
          <section className="bg-surface rounded-3xl px-4 pt-4">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold">
              <Pin className="size-4.5 fill-current" style={{ color: "var(--p1)" }} /> Pinned
            </h2>
            {pinnedCards.map((card, i) => (
              <RecognitionCard
                key={card.id}
                card={card}
                index={i}
                viewer={viewerProps}
                pinned={isMe ? true : undefined}
              />
            ))}
          </section>
        ) : (
          <EmptyShowcase isMe={isMe} />
        )}

        <TrophyCase data={data} allValues={allValues} />
      </div>

      {/* Shout-outs: Received / Given */}
      <nav className="glass sticky top-0 z-20 -mx-4 mt-6 flex px-4 md:mx-0" aria-label="Shout-outs">
        {(
          [
            { key: "received", label: "Received" },
            { key: "given", label: "Given" },
          ] as const
        ).map((t) => (
          <Link
            key={t.key}
            href={t.key === "received" ? `/profile/${user.id}` : `/profile/${user.id}?tab=given`}
            replace
            scroll={false}
            className={cn(
              "relative flex h-12 flex-1 items-center justify-center text-[0.95rem] font-bold transition-colors",
              tab === t.key ? "text-foreground" : "text-muted",
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-full" style={{ backgroundColor: "var(--p1)" }} />
            )}
          </Link>
        ))}
      </nav>

      {cards.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="text-4xl">🌱</span>
          <p className="text-foreground font-display font-bold">Nothing here yet</p>
          <p className="max-w-xs text-sm">
            {tab === "given"
              ? isMe
                ? "Shout-outs you send will show up here."
                : `${firstName} hasn't sent any shout-outs yet.`
              : isMe
                ? "Shout-outs you receive will show up here."
                : `Be the first to hype up ${firstName}.`}
          </p>
        </div>
      ) : (
        <div>
          {cards.map((card, i) => (
            <RecognitionCard
              key={card.id}
              card={card}
              index={i}
              viewer={viewerProps}
              pinned={isMe ? pinnedSet.has(card.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
