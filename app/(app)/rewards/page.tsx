import Link from "next/link";
import { Wallet, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { RewardCard } from "@/components/rewards/reward-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const me = await requireUser();

  const [user, rewards] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { walletBalance: true },
    }),
    prisma.reward.findMany({
      where: {
        active: true,
        OR: [{ siteId: null }, { siteId: me.siteId }],
      },
      orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        imageUrl: true,
        pointsCost: true,
        stock: true,
      },
    }),
  ]);

  // Group by category for display.
  const groups = new Map<string, typeof rewards>();
  for (const r of rewards) {
    const key = r.category ?? "Other";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const categories = [...groups.keys()].sort();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Rewards" description="Spend your points on internal perks and rewards." />

      {/* Balance hero */}
      <section className="bg-brand relative mb-6 overflow-hidden rounded-3xl p-5 text-white shadow-[0_12px_32px_-12px_rgb(217_70_239/0.6)]">
        <Sparkles className="absolute -top-3 -right-3 size-28 opacity-15" aria-hidden />
        <p className="text-sm font-medium text-white/80">Your balance</p>
        <p data-numeric className="mt-1 text-4xl font-semibold tracking-tight">
          {formatNumber(user.walletBalance)}
          <span className="ml-1.5 text-lg font-normal text-white/80">pts</span>
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/me"
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/20 px-4 text-sm font-semibold backdrop-blur transition-transform active:scale-95"
          >
            <Wallet className="size-4" /> Wallet history
          </Link>
          <Link
            href="/recognize"
            className="text-foreground flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold transition-transform active:scale-95"
          >
            Earn more
          </Link>
        </div>
      </section>

      {rewards.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎁</span>
          <p className="text-foreground font-display font-semibold">No rewards right now</p>
          <p className="text-sm">Check back soon — new perks get added regularly.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="font-display mb-3 text-lg font-semibold">{category}</h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                {groups.get(category)!.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    balance={user.walletBalance}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
