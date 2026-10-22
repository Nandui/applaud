import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { RewardCard } from "@/components/rewards/reward-card";
import { StoreTabs } from "@/components/shop/store-tabs";
import { cn } from "@/lib/utils";
import { getOrgSettings } from "@/lib/org-settings";
import { getEconomyStatus, getMonthlyClaimCounts } from "@/lib/budget";
import { checkClaim } from "@/lib/economy";
import { visibleRewardsWhere } from "@/lib/new-items";
import { isNewSince, visitStamp } from "@/lib/seen";
import { MarkSeen } from "@/components/app-shell/new-items";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

/**
 * Rewards store: your balance with the next thing you can unlock, category
 * filters, then a grid of rewards with "N to go" progress bars.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c: activeCategory } = await searchParams;
  const me = await requireUser();
  const renderedAt = visitStamp();

  const [user, catalogue, claims, economy] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { walletBalance: true, rewardsSeenAt: true },
    }),
    prisma.reward.findMany({
      where: visibleRewardsWhere(me),
      orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        imageUrl: true,
        pointsCost: true,
        stock: true,
        euroCostCents: true,
        monthlyStock: true,
        listedAt: true,
      },
    }),
    getMonthlyClaimCounts(),
    getOrgSettings().then(getEconomyStatus),
  ]);
  // Monthly stock and the company budget decide what can be claimed right now.
  // Staff never see euros: a reward over budget just shows "All claimed".
  const rewards = catalogue.map(({ euroCostCents, monthlyStock, listedAt, ...r }) => {
    const claimedThisMonth = claims.get(r.id) ?? 0;
    const check = checkClaim({
      euroCostCents,
      monthlyStock,
      claimedThisMonth,
      spentCents: economy.spentCents,
      budgetCents: economy.budgetCents,
    });
    return {
      ...r,
      monthLeft: monthlyStock === null ? null : Math.max(0, monthlyStock - claimedThisMonth),
      backOn: check.ok ? null : economy.resetsOn,
      isNew: isNewSince(listedAt, user.rewardsSeenAt),
    };
  });
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
  const filtered = Boolean(activeCategory && groups.has(activeCategory));
  const shown = filtered ? [activeCategory!] : categories;
  const freshIn = (cat: string) => groups.get(cat)!.some((r) => r.isNew);

  // The cheapest in-stock reward you can't afford yet: the "next unlock".
  const next = rewards
    .filter((r) => r.pointsCost > balance && (r.stock === null || r.stock > 0) && !r.backOn)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const affordable = rewards.filter(
    (r) => r.pointsCost <= balance && (r.stock === null || r.stock > 0) && !r.backOn,
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
      {/* A filtered view doesn't show everything, so only the full list counts as seen. */}
      {!filtered ? <MarkSeen area="rewards" renderedAt={renderedAt} /> : null}

      {/* Balance hero */}
      <section className="bg-surface mt-4 rounded-2xl p-4">
        <div>
          <p className="text-muted text-sm font-semibold">You&apos;ve got</p>
          <p className="mt-1 flex items-baseline gap-1.5 text-4xl leading-none font-bold tracking-tight">
            <span className="text-primary text-2xl" aria-hidden>
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
                  "flex h-8 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors",
                  active ? "bg-foreground text-background" : "bg-surface-2 text-foreground",
                )}
              >
                {cat ?? "All"}
                {cat && freshIn(cat) ? (
                  <span className="bg-primary ml-1.5 size-1.5 rounded-full">
                    <span className="sr-only">New</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {rewards.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎁</span>
          <p className="text-foreground font-bold">No rewards right now</p>
          <p className="text-sm">Check back soon, new perks get added regularly.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-7">
          {shown.map((category) => (
            <section key={category}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[0.95rem] font-bold">
                {category}
                {freshIn(category) ? (
                  <span className="text-primary text-xs font-semibold" data-numeric>
                    {groups.get(category)!.filter((r) => r.isNew).length} new
                  </span>
                ) : null}
              </h2>
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
