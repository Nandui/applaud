import Link from "next/link";
import { Plus, Award, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getFeedCards } from "@/lib/recognition/queries";
import { APP_NAME } from "@/lib/config";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { FeedComposer } from "@/components/feed/feed-composer";
import { UserAvatar } from "@/components/user-avatar";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const me = await requireUser();
  const [cards, wallet] = await Promise.all([
    getFeedCards(me.id),
    prisma.user.findUnique({
      where: { id: me.id },
      select: { walletBalance: true },
    }),
  ]);
  const viewer = {
    id: me.id,
    name: me.name,
    avatarUrl: me.avatarUrl ?? null,
    role: me.role,
  };

  return (
    <div className="mx-auto max-w-xl">
      <AppBar
        className="mb-0 border-b-0"
        title={
          <span className="bg-brand bg-clip-text text-[1.6rem] font-bold tracking-tighter text-transparent">
            {APP_NAME}
          </span>
        }
        trailing={
          <>
            <Link
              href="/me"
              className="bg-secondary mr-1 flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-transform active:scale-95"
              aria-label="My wallet"
            >
              <Wallet className="text-primary size-4" />
              <span data-numeric>{formatNumber(wallet?.walletBalance ?? 0)}</span>
            </Link>
            <Link href="/awards" aria-label="Awards" className={appBarIconClass}>
              <Award className="size-6" strokeWidth={1.8} />
            </Link>
          </>
        }
      />

      <div className="hidden pb-4 md:block">
        <FeedComposer viewer={{ name: me.name, avatarUrl: me.avatarUrl }} />
      </div>

      {/* Phones: a one-tap prompt into the composer (desktop has FeedComposer). */}
      <Link
        href="/recognize"
        className="bg-surface -mx-4 flex items-center gap-3 border-b border-black/[0.06] px-4 pt-1 pb-3 md:hidden"
      >
        <UserAvatar name={me.name} avatarUrl={me.avatarUrl} className="size-9" />
        <span className="bg-secondary text-muted flex h-10 flex-1 items-center rounded-full px-4 text-sm">
          Who deserves a shout-out today?
        </span>
      </Link>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <span className="bg-brand flex size-16 items-center justify-center rounded-full text-3xl">
            👏
          </span>
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold">No recognition yet</p>
            <p className="text-muted max-w-xs text-sm">
              Be the first to recognise a colleague for great work.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 rounded-full px-6">
            <Link href="/recognize">
              <Plus className="size-4" /> Give recognition
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-2 md:space-y-4 md:pt-0">
          {cards.map((card, i) => (
            <RecognitionCard
              key={card.id}
              card={card}
              index={i}
              viewer={viewer}
            />
          ))}
          <p className="text-muted py-8 text-center text-sm">You&apos;re all caught up ✨</p>
        </div>
      )}
    </div>
  );
}
