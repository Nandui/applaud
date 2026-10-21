import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PartyPopper, Wallet, Gift, Sparkles, MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { getProfileData, CELEBRATION_LABELS } from "@/lib/profile";
import { getReceivedCards } from "@/lib/recognition/queries";
import { valueIcon } from "@/lib/value-icons";
import { formatNumber } from "@/lib/format";
import { UserAvatar } from "@/components/user-avatar";
import { tint } from "@/components/value-chip";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { AppBar } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { AccountSheet } from "@/components/app-shell/account-sheet";

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

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const data = await getProfileData(id);
  if (!data) notFound();

  const { user, stats, valueTags, celebrations } = data;
  const received = await getReceivedCards(id, viewer.id);
  const memberSince = user.hireDate ?? user.createdAt;
  const isMe = viewer.id === user.id;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-xl">
      <AppBar
        className="mb-0 border-b-0"
        leading={isMe ? undefined : <BackButton />}
        title={<span className="text-[1.15rem]">{isMe ? user.name : firstName}</span>}
        trailing={isMe ? <AccountSheet admin={isAdmin(viewer)} /> : undefined}
      />

      {/* Header: avatar + stats, then bio (Instagram profile layout) */}
      <section className="bg-surface -mx-4 px-4 pt-3 pb-4 md:mx-0 md:rounded-2xl md:border md:p-6">
        <div className="flex items-center gap-5">
          <span className="ring-brand shrink-0 rounded-full p-[3px]">
            <span className="bg-surface block rounded-full p-[3px]">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                className="size-[5.25rem] text-xl"
              />
            </span>
          </span>
          <dl className="grid flex-1 grid-cols-3 text-center">
            <Stat value={stats.receivedCount} label="received" />
            <Stat value={stats.pointsEarned} label="points" />
            <Stat value={stats.givenCount} label="given" />
          </dl>
        </div>

        <div className="mt-3 space-y-0.5">
          <h1 className="font-display text-lg leading-tight font-semibold">
            {user.name}
            {user.role !== "staff" && (
              <span className="bg-secondary text-muted ml-2 rounded-full px-2 py-0.5 align-middle text-[0.7rem] font-semibold capitalize">
                {user.role}
              </span>
            )}
          </h1>
          {user.jobTitle && <p className="text-sm">{user.jobTitle}</p>}
          <p className="text-muted text-sm">
            {user.site ? `${user.site.name} · ` : ""}Since{" "}
            {format(memberSince, "MMM yyyy")}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Link
                href="/me"
                className="bg-secondary flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                <Wallet className="size-4" /> Wallet
              </Link>
              <Link
                href="/rewards"
                className="bg-secondary flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                <Gift className="size-4" /> Rewards
              </Link>
            </>
          ) : (
            <Link
              href={`/recognize?to=${user.id}`}
              className="bg-brand flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              <Sparkles className="size-4" /> Recognise {firstName}
            </Link>
          )}
        </div>

        {/* Highlights: values they're recognised for + milestones */}
        {(valueTags.length > 0 || celebrations.length > 0) && (
          <div className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            {valueTags.map((t) => {
              const Icon = valueIcon(t.value.icon);
              return (
                <div key={t.value.id} className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5">
                  <span className="border-border relative flex size-16 items-center justify-center rounded-full border p-[3px]">
                    <span
                      className="flex size-full items-center justify-center rounded-full"
                      style={{
                        backgroundColor: tint(t.value.color, 0.14) ?? "var(--color-secondary)",
                        color: t.value.color ?? undefined,
                      }}
                    >
                      <Icon className="size-6" />
                    </span>
                    <span
                      data-numeric
                      className="bg-foreground ring-surface absolute -right-1 -bottom-1 rounded-full px-1.5 text-[0.65rem] font-semibold text-white ring-2"
                    >
                      ×{t.count}
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-xs">{t.value.name}</span>
                </div>
              );
            })}
            {celebrations.map((c) => (
              <div key={c.id} className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5">
                <span className="border-border flex size-16 items-center justify-center rounded-full border p-[3px]">
                  <span className="bg-brand flex size-full items-center justify-center rounded-full text-white">
                    <PartyPopper className="size-6" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs">
                  {CELEBRATION_LABELS[c.type] ?? c.type}
                </span>
                <span className="text-muted -mt-1 text-[0.65rem]">
                  {format(c.occurredOn, "MMM yyyy")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tab strip */}
      <div className="bg-surface -mx-4 flex border-t border-black/[0.06] md:mx-0 md:mt-4 md:rounded-t-2xl md:border">
        <span className="border-foreground flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold">
          <MessageSquareHeart className="size-4.5" /> Recognition received
        </span>
      </div>

      {received.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="text-4xl">🌱</span>
          <p className="text-foreground font-display font-semibold">Nothing here yet</p>
          <p className="max-w-xs text-sm">
            {isMe
              ? "Recognition you receive will show up here."
              : `Be the first to recognise ${firstName}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pt-2 md:space-y-4 md:pt-4">
          {received.map((card, i) => (
            <RecognitionCard
              key={card.id}
              card={card}
              index={i}
              viewer={{
                id: viewer.id,
                name: viewer.name,
                avatarUrl: viewer.avatarUrl ?? null,
                role: viewer.role,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse items-center">
      <dt className="text-muted text-[0.8rem]">{label}</dt>
      <dd data-numeric className="text-lg leading-tight font-semibold">
        {formatNumber(value)}
      </dd>
    </div>
  );
}
