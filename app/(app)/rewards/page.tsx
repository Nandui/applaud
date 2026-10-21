import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { RewardCard } from "@/components/rewards/reward-card";
import { StoreTabs } from "@/components/shop/store-tabs";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

/**
 * Rewards store (CHOPT / Xbox Rewards): a balance hero with the next thing
 * you can unlock, category chips, then tiles with "N to go" progress bars.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c: activeCategory } = await searchParams;
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
  const balance = user.walletBalance;

  // Group by category for display.
  const groups = new Map<string, typeof rewards>();
  for (const r of rewards) {
    const key = r.category ?? "Other";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const categories = [...groups.keys()].sort();
  const shown = activeCategory && groups.has(activeCategory) ? [activeCategory] : categories;

  // The cheapest in-stock reward you can't afford yet: the "next unlock".
  const next = rewards
    .filter((r) => r.pointsCost > balance && (r.stock === null || r.stock > 0))
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const affordable = rewards.filter(
    (r) => r.pointsCost <= balance && (r.stock === null || r.stock > 0),
  ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <AppBar
        title="Store"
        tabs={<StoreTabs active="rewards" />}
        trailing={
          <Link href="/me" aria-label="Wallet history" className={appBarIconClass}>
            <History className="size-5.5" />
          </Link>
        }
      />

      {/* Balance hero */}
      <section className="bg-surface relative overflow-hidden rounded-3xl p-5">
        <div className="bg-brand absolute -top-20 -right-16 size-56 rounded-full opacity-40 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-muted text-sm font-semibold">You&apos;ve got</p>
          <p className="font-display mt-1 flex items-baseline gap-2 text-5xl leading-none font-extrabold tracking-tight">
            <span className="text-primary text-3xl" aria-hidden>
              ✦
            </span>
            <span data-numeric>{formatNumber(balance)}</span>
            <span className="text-muted text-lg font-semibold">pts</span>
          </p>
          <p className="text-muted mt-2 text-sm">
            {affordable > 0
              ? `Enough for ${affordable} reward${affordable === 1 ? "" : "s"} right now.`
              : "Keep collecting shout-outs to unlock your first reward."}
          </p>
          {next ? (
            <div className="bg-surface-2 mt-4 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted">Next up · </span>
                  <span className="font-semibold">{next.name}</span>
                </span>
                <span data-numeric className="shrink-0 font-bold">
                  {formatNumber(next.pointsCost - balance)} to go
                </span>
              </div>
              <div className="bg-surface-3 mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.max(4, Math.round((balance / next.pointsCost) * 100))}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {categories.length > 1 ? (
        <nav className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" aria-label="Categories">
          {[undefined, ...categories].map((cat) => {
            const active = cat === (activeCategory && groups.has(activeCategory) ? activeCategory : undefined);
            return (
              <Link
                key={cat ?? "all"}
                href={cat ? `/rewards?c=${encodeURIComponent(cat)}` : "/rewards"}
                replace
                scroll={false}
                className={cn(
                  "flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-colors",
                  active ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground",
                )}
              >
                {cat ?? "All"}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {rewards.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎁</span>
          <p className="text-foreground font-display font-bold">No rewards right now</p>
          <p className="text-sm">Check back soon, new perks get added regularly.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-7">
          {shown.map((category) => (
            <section key={category}>
              <h2 className="font-display mb-3 text-xl font-bold">{category}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {groups.get(category)!.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} balance={balance} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
