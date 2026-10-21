import Link from "next/link";
import { notFound } from "next/navigation";
import { Pin } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { getProfileData } from "@/lib/profile";
import { getCardsByIds, getGivenCards, getReceivedCards } from "@/lib/recognition/queries";
import { bannerStyle, themeColour } from "@/lib/cosmetics";
import { isLight } from "@/lib/profile-custom";
import { FramedAvatar } from "@/components/user-avatar";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { AccountSheet } from "@/components/app-shell/account-sheet";
import { Highlights, Managers, Stats } from "@/components/profile/profile-parts";
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

type Tab = "received" | "given";

const secondaryButton =
  "bg-surface-2 flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-opacity active:opacity-70";

/**
 * Profile, laid out like Instagram: counts beside the avatar, name and bio,
 * two buttons, highlight circles, then tabs. The banner, avatar frame and
 * accent colour are the person's own picks from the profile shop.
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
  const accent = themeColour(custom.theme);
  const onAccent = isLight(accent) ? "#0a0a0a" : "#ffffff";

  const [cards, pinnedCards] = await Promise.all([
    tab === "given" ? getGivenCards(user.id, viewer.id) : getReceivedCards(user.id, viewer.id),
    tab === "received" ? getCardsByIds(custom.pinned, viewer.id) : Promise.resolve([]),
  ]);
  const pinnedSet = new Set(custom.pinned);
  const listed = cards.filter((c) => !(tab === "received" && pinnedSet.has(c.id)));
  const viewerProps = {
    id: viewer.id,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl ?? null,
    role: viewer.role,
    frame: isMe ? custom.frame : null,
  };

  return (
    <div className="mx-auto max-w-xl">
      <AppBar
        title={<span className="text-xl">{user.name}</span>}
        leading={isMe ? undefined : <BackButton />}
        trailing={isMe ? <AccountSheet admin={isAdmin(viewer)} triggerClassName={appBarIconClass} /> : null}
      />

      <div className="h-24 rounded-xl" style={{ background: bannerStyle(custom.banner) }} />

      <div className="-mt-10 flex items-end gap-4 pl-2">
        <FramedAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          frame={custom.frame}
          className="size-20 text-xl"
          large
        />
        <div className="flex flex-1 pb-1">
          <Stats data={data} />
        </div>
      </div>

      <section className="mt-3 space-y-1">
        <h1 className="text-[0.95rem] font-bold">
          {user.name}
          {custom.pronouns ? <span className="text-muted ml-1.5 font-normal">{custom.pronouns}</span> : null}
        </h1>
        <p className="text-muted text-sm">{[user.jobTitle, user.site?.name].filter(Boolean).join(" · ")}</p>
        {custom.bio ? <p className="text-sm whitespace-pre-line">{custom.bio}</p> : null}
        <Managers data={data} />
      </section>

      <div className="mt-4 flex gap-2">
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

      <div className="mt-5">
        <Highlights data={data} />
      </div>

      <TabLinks
        className="glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-4 md:mx-0"
        accent={accent}
        active={tab}
        tabs={[
          { key: "received", label: "Received", href: `/profile/${user.id}` },
          { key: "given", label: "Given", href: `/profile/${user.id}?tab=given` },
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
          <p className="text-foreground font-bold">No shout-outs yet</p>
          <p className="max-w-xs text-sm">
            {tab === "given"
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
