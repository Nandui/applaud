import Link from "next/link";
import { ChevronRight, History, PackageOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { RewardCard } from "@/components/rewards/reward-card";
import { DiscountCard } from "@/components/rewards/discount-card";
import { endsLabel, promoRank, promoState } from "@/lib/reward-promo";
import { StoreTabs } from "@/components/shop/store-tabs";
import { cn } from "@/lib/utils";
import { getOrgSettings } from "@/lib/org-settings";
import { getEconomyStatus, getMonthlyClaimCounts } from "@/lib/budget";
import { checkClaim } from "@/lib/economy";
import { visibleRewardsWhere } from "@/lib/new-items";
import { isNewSince, visitStamp } from "@/lib/seen";
import { MarkSeen } from "@/components/app-shell/new-items";
import { fulfilmentLabel } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

/**
 * Rewards store: your balance, standing staff discounts, a Featured row of
 * labelled offers, category filters, then a grid of rewards with "N to go"
 * progress bars.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c: activeCategory } = await searchParams;
  const me = await requireUser();
  const renderedAt = visitStamp();

  const [user, catalogue, claims, economy, myOpen] = await Promise.all([
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
        kind: true,
        discountText: true,
        promoTag: true,
        promoText: true,
        promoEndsAt: true,
        wasPointsCost: true,
        fulfilmentAmount: true,
        fulfilmentUnit: true,
      },
    }),
    getMonthlyClaimCounts(),
    getOrgSettings().then(getEconomyStatus),
    prisma.redemption.count({ where: { userId: me.id, status: { in: ["requested", "approved"] } } }),
  ]);
  // Monthly stock and the company budget decide what can be claimed right now.
  // Staff never see euros: a reward over budget just shows "All claimed".
  const now = new Date(renderedAt);
  const all = catalogue.map(
    ({ euroCostCents, monthlyStock, listedAt, promoTag, promoText, promoEndsAt, wasPointsCost, fulfilmentAmount, fulfilmentUnit, ...r }) => {
      const promo = promoState({ ...r, promoTag, promoText, promoEndsAt, wasPointsCost }, now);
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
        pointsCost: promo.pointsCost,
        wasPointsCost: promo.wasPointsCost,
        promo: promo.tag
          ? {
              tag: promo.tag,
              label: promo.label!,
              ends: promo.endsAt ? endsLabel(promo.endsAt, now) : null,
            }
          : null,
        rank: promoRank(promo),
        monthLeft: monthlyStock === null ? null : Math.max(0, monthlyStock - claimedThisMonth),
        backOn: check.ok ? null : economy.resetsOn,
        isNew: isNewSince(listedAt, user.rewardsSeenAt),
        wait: fulfilmentLabel(fulfilmentAmount, fulfilmentUnit),
      };
    },
  );
  const balance = user.walletBalance;
  // Standing staff discounts get their own section; everything else is claimed with points.
  const discounts = all.filter((r) => r.kind === "discount");
  const rewards = all.filter((r) => r.kind !== "discount");
  const featured = rewards.filter((r) => r.promo).sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1]);

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
        </div>
        <Link
          href="/rewards/claimed"
          className="border-border mt-4 -mb-1 flex items-center gap-3 border-t pt-3 active:opacity-70"
        >
          <PackageOpen className="text-primary size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-sm font-semibold">My rewards</span>
          <span className="text-muted text-sm" data-numeric>
            {myOpen > 0 ? `${myOpen} on the way` : "Claims and status"}
          </span>
          <ChevronRight className="text-muted size-4" aria-hidden />
        </Link>
      </section>

      {!filtered && discounts.length > 0 ? (
        <section className="mt-6" aria-labelledby="discounts-heading">
          <h2 id="discounts-heading" className="mb-2 flex items-baseline gap-2 text-[0.95rem] font-bold">
            Staff discounts
            <span className="text-muted text-xs font-medium">Always on, no points needed</span>
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {discounts.map((d) => (
              <DiscountCard key={d.id} discount={d} />
            ))}
          </div>
        </section>
      ) : null}

      {!filtered && featured.length > 0 ? (
        <section className="mt-6" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-2 text-[0.95rem] font-bold">
            Featured
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((reward) => (
              <div key={reward.id} className="w-[46%] shrink-0 snap-start sm:w-56">
                <RewardCard reward={reward} balance={balance} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

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

      {rewards.length === 0 && discounts.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎁</span>
          <p className="text-foreground font-bold">No rewards right now</p>
          <p className="text-sm">Check back soon, new perks get added regularly.</p>
        </div>
      ) : rewards.length === 0 ? null : (
        <div className="mt-6 space-y-7">
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
