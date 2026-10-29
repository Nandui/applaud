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
import { Highlights, Managers, Stats } from "@/components/profile/profile-parts";
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

type Tab = "received" | "given" | "posts";

const secondaryButton =
  "bg-surface-2 flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-opacity active:opacity-70";

/**
 * Profile, laid out like Instagram under a full-width banner: counts beside
 * the avatar, name and bio, two buttons, highlight circles, then tabs. The banner, avatar frame and
 * accent colour are the person's own picks from the profile shop. It moves a
 * little: the banner drifts, rarer frames shimmer, the counts ease up and
 * the header rises in (see "Profile motion" in globals.css).
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
  const tab: Tab = rawTab === "given" || rawTab === "posts" ? rawTab : "received";
  const profile = getProfileData(id);
  const viewer = await requireUser();
  // Profiles are linked by id, so the shout-out list can load alongside the
  // header instead of after it (only pinned cards need the profile first).
  const listFor = (userId: string) =>
    tab === "given"
      ? getGivenCards(userId, viewer.id)
      : tab === "posts"
        ? getPostCards(userId, viewer.id)
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

  const [cards, pinnedCards] = await Promise.all([
    user.id === id ? early : listFor(user.id),
    tab === "received" ? getCardsByIds(custom.pinned, viewer.id) : Promise.resolve([]),
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

  return (
    <div className="mx-auto max-w-xl">
      <AppBar
        title={<span className="text-xl">{user.name}</span>}
        leading={isMe ? undefined : <BackButton />}
        trailing={isMe ? <AccountSheet admin={isAdmin(viewer)} triggerClassName={appBarIconClass} /> : null}
      />

      {/* The banner is shown whole (uploads are 3:1) and edge to edge on
          phones: it's the biggest thing people buy in the shop. */}
      <ProfileBanner background={look.banner} className="-mx-4 aspect-[3/1] md:mx-0 md:rounded-2xl" />

      <div className="rise-in relative -mt-14 flex items-end gap-4 pl-2" style={rise(0)}>
        <FramedAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          frame={look.frame}
          className="size-24 text-2xl"
          large
          shine={frameRarity}
        />
        <div className="flex flex-1 pb-1">
          <Stats data={data} />
        </div>
      </div>

      <section className="rise-in mt-3 space-y-1" style={rise(1)}>
        <h1 className="text-[0.95rem] font-bold">
          {user.name}
          {custom.pronouns ? <span className="text-muted ml-1.5 font-normal">{custom.pronouns}</span> : null}
        </h1>
        <p className="text-muted text-sm">{[user.jobTitle, user.site?.name].filter(Boolean).join(" · ")}</p>
        {custom.bio ? <p className="text-sm whitespace-pre-line">{custom.bio}</p> : null}
        <Managers data={data} />
      </section>

      <div className="rise-in mt-4 flex gap-2" style={rise(2)}>
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
            className="flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            Send {firstName} a shout-out
          </Link>
        )}
      </div>

      <div className="rise-in mt-5" style={rise(3)}>
        <Highlights data={data} />
      </div>

      <TabLinks
        className="glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-4 md:mx-0"
        accent={accent}
        active={tab}
        tabs={[
          { key: "received", label: "Received", href: `/profile/${user.id}` },
          { key: "given", label: "Given", href: `/profile/${user.id}?tab=given` },
          { key: "posts", label: "Posts", href: `/profile/${user.id}?tab=posts` },
        ]}
      />

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
          <p className="text-foreground font-bold">{tab === "posts" ? "No posts yet" : "No shout-outs yet"}</p>
          <p className="max-w-xs text-sm">
            {tab === "posts"
              ? isMe
                ? "Posts you share in the feed will show up here."
                : `${firstName} hasn't posted anything yet.`
              : tab === "given"
              ? isMe
                ? "Shout-outs you send will show up here."
                : `${firstName} hasn't sent any shout-outs yet.`
              : isMe
                ? "Shout-outs you receive will show up here."
                : `Be the first to give ${firstName} a shout-out.`}
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
    </div>
  );
}
