import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RewardCard } from "@/components/rewards/reward-card";
import { StaffDiscounts } from "@/components/rewards/discount-card";
import { WalletExpiryNote } from "@/components/rewards/wallet-expiry";
import type { RewardsShopData } from "@/lib/rewards/shop";

/**
 * The body of the staff Rewards page: staff discounts, balance, Featured row,
 * category chips and the category grids. Rendered by /rewards and by the
 * admin's phone preview, so both always match.
 */
export function RewardsShop({
  data,
  balance,
  activeCategory,
  claimsStrip,
  ideas,
  categoryHref = (cat) => (cat ? `/rewards?c=${encodeURIComponent(cat)}` : "/rewards"),
}: {
  data: RewardsShopData;
  balance: number;
  activeCategory?: string;
  /** Your open claims, between the balance and Featured (the live page only). */
  claimsStrip?: React.ReactNode;
  /** The "Suggest an idea" card, under the balance (the live page only). */
  ideas?: React.ReactNode;
  categoryHref?: (cat: string | undefined) => string;
}) {
  const { discounts, featured, categories, settings } = data;
  const rewards = categories.flatMap((c) => c.items);
  const names = categories.map((c) => c.name);
  const filtered = Boolean(activeCategory && names.includes(activeCategory));
  const shown = filtered ? categories.filter((c) => c.name === activeCategory) : categories;
  const freshIn = (items: { isNew?: boolean }[]) => items.filter((r) => r.isNew).length;

  const affordable = rewards.filter(
    (r) => r.pointsCost <= balance && (r.stock === null || r.stock > 0) && !r.backOn,
  ).length;

  return (
    <>
      {/* Staff discounts lead the page: they're for everyone, every day. */}
      {!filtered ? <StaffDiscounts discounts={discounts} /> : null}

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
              : "Keep collecting recognitions to unlock your first reward."}
          </p>
          <WalletExpiryNote balance={balance} enabled={settings.walletPointsExpireYearEnd} className="mt-2" />
        </div>
      </section>

      {!filtered ? claimsStrip : null}

      {!filtered ? ideas : null}

      {!filtered && featured.length > 0 ? (
        <section className="mt-6" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-2 text-[0.95rem] font-bold">
            Featured
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2">
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
          {[undefined, ...names].map((cat) => {
            const active = cat === (filtered ? activeCategory : undefined);
            const fresh = cat ? freshIn(categories.find((c) => c.name === cat)!.items) > 0 : false;
            return (
              <Link
                key={cat ?? "all"}
                href={categoryHref(cat)}
                replace
                scroll={false}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors",
                  active ? "bg-foreground text-background" : "bg-surface-2 text-foreground",
                )}
              >
                {cat ?? "All"}
                {fresh ? (
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
            <section key={category.name} data-category={category.name}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[0.95rem] font-bold">
                {category.name}
                {freshIn(category.items) > 0 ? (
                  <span className="text-primary text-xs font-semibold" data-numeric>
                    {freshIn(category.items)} new
                  </span>
                ) : null}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {category.items.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} balance={balance} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
