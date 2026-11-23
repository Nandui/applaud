import Link from "next/link";
import { notFound } from "next/navigation";
import { Pin } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { getProfileData } from "@/lib/profile";
import { getCardsByIds, getGivenCards, getPostCards, getReceivedCards } from "@/lib/recognition/queries";
import { isLight, wornItem } from "@/lib/profile-custom";
import { FramedAvatar } from "@/components/user-avatar";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { AccountSheet } from "@/components/app-shell/account-sheet";
import { Managers } from "@/components/profile/profile-parts";
import {
  AwardShelf,
  Collection,
  Milestones,
  ShowcaseSection,
  ShowcaseStats,
  ValueShelf,
} from "@/components/profile/profile-showcase";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { TabLinks } from "@/components/tab-links";

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

type Tab = "showcase" | "received" | "given" | "posts";

const secondaryButton =
  "bg-surface-2 flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-opacity active:opacity-70";

/**
 * A person's profile, built to show them off. On top, their shop look: the
 * banner whole and edge to edge, their framed avatar over it and a wash of
 * their theme colour behind the name (a card on desktop). Under that their
 * counts, then tabs. The first tab, Showcase, gathers what they've earned
 * (pinned recognitions, awards, values they're recognized for, their
 * shop collection, latest recognition and milestones); the others list their
 * recognitions received and given, and their posts. It moves a little: the
 * banner drifts, rarer frames shimmer, the counts ease up and the header
 * rises in (see "Profile motion" in globals.css).
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
  const tab: Tab =
    rawTab === "received" || rawTab === "given" || rawTab === "posts" ? rawTab : "showcase";
  const profile = getProfileData(id);
  const viewer = await requireUser();
  // Profiles are linked by id, so the card list can load alongside the
  // header instead of after it (only pinned cards need the profile first).
  const listFor = (userId: string) =>
    tab === "given"
      ? getGivenCards(userId, viewer.id)
      : tab === "posts"
        ? getPostCards(userId, viewer.id)
        : tab === "showcase"
          ? getReceivedCards(userId, viewer.id, 1)
          : getReceivedCards(userId, viewer.id);
  const early = listFor(id);
  const data = await profile;
  if (!data) notFound();

  const { user, custom, look } = data;
  const isMe = viewer.id === user.id;
  const firstName = user.name.split(" ")[0];
  const accent = look.theme;
  const onAccent = isLight(accent) ? "#0a0a0a" : "#ffffff";
  const frameRarity = wornItem(custom, "frame", data.catalogue)?.rarity ?? null;
  // Each block of the header rises in a beat after the one above it.
  const rise = (i: number) => ({ "--rise": i }) as React.CSSProperties;
  // The theme colour washes in behind the header, strongest at the top where
  // the avatar sits (its gap ring takes the same tint so it blends in).
  const tint = `color-mix(in srgb, ${accent} 14%, var(--background))`;

  const [cards, pinnedCards] = await Promise.all([
    user.id === id ? early : listFor(user.id),
    tab === "received" || tab === "showcase"
      ? getCardsByIds(custom.pinned, viewer.id)
      : Promise.resolve([]),
  ]);
  const pinnedSet = new Set(custom.pinned);
  const listed = cards.filter((c) => !(tab === "received" && pinnedSet.has(c.id)));
  const viewerProps = {
    id: viewer.id,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl ?? null,
    role: viewer.role,
    frame: isMe ? look.frame : null,
  };
  const href = (t: Tab) => (t === "showcase" ? `/profile/${user.id}` : `/profile/${user.id}?tab=${t}`);

  return (
    <div className="mx-auto max-w-2xl">
      <AppBar
        title={<span className="text-xl">{user.name}</span>}
        leading={isMe ? undefined : <BackButton />}
        trailing={isMe ? <AccountSheet admin={isAdmin(viewer)} triggerClassName={appBarIconClass} /> : null}
      />

      {/* Edge to edge on phones; a single card on wider screens. */}
      <div className="border-border -mx-4 md:mx-0 md:overflow-hidden md:rounded-2xl md:border">
        {/* The banner is shown whole (uploads are 3:1): it's the biggest
            thing people buy in the shop. */}
        <ProfileBanner background={look.banner} className="aspect-[3/1]" />

        <div
          className="px-4 pb-4"
          style={
            {
              background: `linear-gradient(180deg, ${tint} 0%, var(--background) 100%)`,
              "--hero-gap": tint,
            } as React.CSSProperties
          }
        >
          <div className="rise-in relative -mt-16 flex items-end justify-between gap-3 sm:-mt-20" style={rise(0)}>
            <FramedAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              frame={look.frame}
              className="size-28 text-3xl sm:size-36 sm:text-4xl"
              gapClassName="[background:var(--hero-gap)]"
              large
              shine={frameRarity}
            />
            <div className="flex gap-2 pb-1">
              {isMe ? (
                <>
                  <Link href="/profile/edit" className={secondaryButton}>
                    Edit profile
                  </Link>
                  <Link href="/shop" className={secondaryButton}>
                    Customize
                  </Link>
                </>
              ) : (
                <Link
                  href={`/recognize?to=${user.id}`}
                  className="flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-opacity active:opacity-80"
                  style={{ backgroundColor: accent, color: onAccent }}
                >
                  Recognize {firstName}
                </Link>
              )}
            </div>
          </div>

          <section className="rise-in mt-3 space-y-1" style={rise(1)}>
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
              {user.name}
              {custom.pronouns ? (
                <span className="text-muted ml-2 align-middle text-sm font-medium">{custom.pronouns}</span>
              ) : null}
            </h1>
            <p className="text-muted text-sm">{[user.jobTitle, user.site?.name].filter(Boolean).join(" · ")}</p>
            {custom.bio ? <p className="pt-1 text-[0.95rem] whitespace-pre-line">{custom.bio}</p> : null}
            <Managers data={data} />
          </section>

          <div className="rise-in mt-4" style={rise(2)}>
            <ShowcaseStats data={data} />
          </div>
        </div>
      </div>

      <TabLinks
        className="glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-2 md:mx-0"
        accent={accent}
        active={tab}
        tabs={[
          { key: "showcase", label: "Showcase", href: href("showcase") },
          { key: "received", label: "Received", href: href("received") },
          { key: "given", label: "Given", href: href("given") },
          { key: "posts", label: "Posts", href: href("posts") },
        ]}
      />

      {tab === "showcase" ? (
        <div>
          {pinnedCards.length > 0 ? (
            <ShowcaseSection title="Pinned" count={pinnedCards.length}>
              <div className="-mt-3">
                {pinnedCards.map((card, i) => (
                  <RecognitionCard key={card.id} card={card} index={i} viewer={viewerProps} pinned={isMe ? true : undefined} />
                ))}
              </div>
            </ShowcaseSection>
          ) : null}

          {data.awards.length > 0 ? (
            <ShowcaseSection title="Awards" count={data.awards.length}>
              <AwardShelf data={data} />
            </ShowcaseSection>
          ) : null}

          {data.valueTags.length > 0 ? (
            <ShowcaseSection title="Recognized for" count={data.valueTags.length}>
              <ValueShelf data={data} />
            </ShowcaseSection>
          ) : null}

          <ShowcaseSection
            title="Collection"
            count={data.collection.length}
            action={isMe ? { label: "Store", href: "/shop", color: accent } : undefined}
          >
            {data.collection.length > 0 ? (
              <Collection data={data} accent={accent} />
            ) : (
              <p className="text-muted text-sm">
                {isMe
                  ? "Frames, banners and colours you get in the Store show up here."
                  : `${firstName} hasn't picked up any frames, banners or colours yet.`}
              </p>
            )}
          </ShowcaseSection>

          {pinnedCards.length === 0 && cards.length > 0 ? (
            <ShowcaseSection
              title="Latest recognition"
              action={{ label: "See all", href: href("received"), color: accent }}
            >
              <div className="-mt-3">
                <RecognitionCard card={cards[0]} index={0} viewer={viewerProps} pinned={isMe ? false : undefined} />
              </div>
            </ShowcaseSection>
          ) : null}

          {data.celebrations.length > 0 ? (
            <ShowcaseSection title="Milestones">
              <Milestones data={data} />
            </ShowcaseSection>
          ) : null}

          {data.awards.length === 0 && data.valueTags.length === 0 && cards.length === 0 && pinnedCards.length === 0 ? (
            <div className="text-muted flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-foreground font-bold">Nothing to show off yet</p>
              <p className="max-w-xs text-sm">
                {isMe
                  ? "Recognitions, awards and values you're recognized for will fill this page."
                  : `Be the first to recognize ${firstName}.`}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {pinnedCards.length > 0 && (
            <div>
              {pinnedCards.map((card, i) => (
                <div key={card.id}>
                  <p className="text-muted flex items-center gap-1.5 pt-3 text-xs font-semibold">
                    <Pin className="size-3.5 fill-current" /> Pinned
                  </p>
                  <RecognitionCard card={card} index={i} viewer={viewerProps} pinned={isMe ? true : undefined} />
                </div>
              ))}
            </div>
          )}

          {listed.length === 0 && pinnedCards.length === 0 ? (
            <div className="text-muted flex flex-col items-center gap-2 px-6 py-16 text-center">
              <p className="text-foreground font-bold">{tab === "posts" ? "No posts yet" : "No recognitions yet"}</p>
              <p className="max-w-xs text-sm">
                {tab === "posts"
                  ? isMe
                    ? "Posts you share in the feed will show up here."
                    : `${firstName} hasn't posted anything yet.`
                  : tab === "given"
                  ? isMe
                    ? "Recognitions you send will show up here."
                    : `${firstName} hasn't recognized anyone yet.`
                  : isMe
                    ? "Recognitions you receive will show up here."
                    : `Be the first to recognize ${firstName}.`}
              </p>
            </div>
          ) : (
            <div>
              {listed.map((card, i) => (
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
        </>
      )}
    </div>
  );
}
