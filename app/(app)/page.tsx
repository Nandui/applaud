import Link from "next/link";
import { ImagePlus, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getFeedCards } from "@/lib/recognition/queries";
import { parseProfile } from "@/lib/profile-custom";
import { formatNumber } from "@/lib/format";
import { AppBar } from "@/components/app-shell/app-bar";
import { Wordmark } from "@/components/app-shell/brand";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { FramedAvatar } from "@/components/user-avatar";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const me = await requireUser();
  const [cards, wallet] = await Promise.all([
    getFeedCards(me.id),
    prisma.user.findUnique({
      where: { id: me.id },
      select: { walletBalance: true, profile: true },
    }),
  ]);
  const viewer = {
    id: me.id,
    name: me.name,
    avatarUrl: me.avatarUrl ?? null,
    role: me.role,
    frame: parseProfile(wallet?.profile).frame,
  };
  const myPins = new Set(parseProfile(wallet?.profile).pinned);

  return (
    <div className="mx-auto max-w-xl">
      <AppBar
        className="mb-0"
        title={<Wordmark />}
        trailing={
          <Link
            href="/me"
            className="bg-surface-2 flex h-9 items-center gap-1.5 rounded-full pr-3.5 pl-1.5 text-sm font-bold transition-transform active:scale-95"
            aria-label="My wallet"
          >
            <span className="bg-primary text-primary-fg flex size-6 items-center justify-center rounded-full text-[0.7rem] font-black">
              ✦
            </span>
            <span data-numeric>{formatNumber(wallet?.walletBalance ?? 0)}</span>
          </Link>
        }
      />

      {/* "What's new?" prompt: one tap into the Send flow. */}
      <Link
        href="/recognize"
        className="border-border flex items-center gap-3 border-b py-3"
      >
        <FramedAvatar
          name={me.name}
          avatarUrl={me.avatarUrl}
          frame={parseProfile(wallet?.profile).frame}
          className="size-10"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold">{me.name}</span>
          <span className="text-muted block truncate text-[0.95rem]">
            Who deserves a shout-out today?
          </span>
        </span>
        <span className="text-muted flex size-9 items-center justify-center">
          <ImagePlus className="size-5" />
        </span>
      </Link>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <span className="bg-brand flex size-16 items-center justify-center rounded-3xl text-3xl">
            👏
          </span>
          <div className="space-y-1">
            <p className="font-display text-xl font-bold">It&apos;s quiet in here</p>
            <p className="text-muted max-w-xs text-sm">
              Be the first to hype up a teammate.
            </p>
          </div>
          <Link
            href="/recognize"
            className="bg-primary flex h-12 items-center gap-2 rounded-full px-6 font-semibold text-white"
          >
            <Plus className="size-4" /> Send a shout-out
          </Link>
        </div>
      ) : (
        <div>
          {cards.map((card, i) => (
            <RecognitionCard
              key={card.id}
              card={card}
              index={i}
              viewer={viewer}
              pinned={myPins.has(card.id)}
            />
          ))}
          <p className="text-muted py-10 text-center text-sm">You&apos;re all caught up ✨</p>
        </div>
      )}
    </div>
  );
}
