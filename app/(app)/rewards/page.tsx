import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { StoreTabs } from "@/components/shop/store-tabs";
import { visitStamp } from "@/lib/seen";
import { MarkSeen } from "@/components/app-shell/new-items";
import { getActiveClaims } from "@/lib/claims";
import { ClaimsStrip } from "@/components/rewards/active-claims";
import { loadRewardsShop } from "@/lib/rewards/shop";
import { RewardsShop } from "@/components/rewards/rewards-shop";
import { IdeasEntry } from "@/components/ideas/ideas-entry";
import { OpenFromUrl } from "@/components/open-from-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

/**
 * Rewards store: standing staff discounts, your balance, a Featured row of
 * labelled offers, category filters, then a grid of rewards with "N to go"
 * progress bars. The order comes from Admin > Rewards (lib/rewards/layout.ts).
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c: activeCategory } = await searchParams;
  const me = await requireUser();
  const renderedAt = visitStamp();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { walletBalance: true, rewardsSeenAt: true },
  });
  const [data, myClaims] = await Promise.all([
    loadRewardsShop({ siteIds: me.siteIds, seenAt: user.rewardsSeenAt, now: new Date(renderedAt) }),
    getActiveClaims(me.id),
  ]);
  const filtered = Boolean(activeCategory && data.categories.some((c) => c.name === activeCategory));

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
      <OpenFromUrl />
      <RewardsShop
        data={data}
        balance={user.walletBalance}
        activeCategory={activeCategory}
        claimsStrip={<ClaimsStrip claims={myClaims} />}
      />
      {!filtered ? <IdeasEntry kind="reward" /> : null}
    </div>
  );
}
