import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AppBar } from "@/components/app-shell/app-bar";
import { StoreTabs } from "@/components/shop/store-tabs";
import { loadRewardsShop } from "@/lib/rewards/shop";
import { RewardsShop } from "@/components/rewards/rewards-shop";
import { PreviewShield } from "@/components/admin/preview-shield";
import { parseEndDate } from "@/lib/reward-promo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards preview" };

/**
 * The staff Rewards page exactly as a staff member at `site` sees it on `at`
 * (a YYYY-MM-DD day, Irish time; default now), for the preview frame in
 * Admin > Rewards. Taps do nothing here, so nothing can be claimed.
 */
export default async function RewardsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; at?: string; c?: string; focus?: string; pts?: string }>;
}) {
  const { site, at, c, focus, pts } = await searchParams;
  const me = await requireAdmin();

  const siteId = site && site !== "all" ? site : null;
  // Midday of the chosen day, so labels ending that night still show.
  const dayEnd = at ? parseEndDate(at) : null;
  const now = dayEnd ? new Date(dayEnd.getTime() - 12 * 3_600_000) : new Date();
  const balanceRaw = Number(pts);
  const balance = Number.isFinite(balanceRaw) && pts !== undefined && pts !== ""
    ? Math.max(0, Math.floor(balanceRaw))
    : (await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { walletBalance: true } })).walletBalance;

  const data = await loadRewardsShop({ siteId, seenAt: now, now });
  const base = new URLSearchParams();
  if (site) base.set("site", site);
  if (at) base.set("at", at);
  if (pts) base.set("pts", pts);

  return (
    <div className="mx-auto max-w-3xl">
      <PreviewShield focus={focus ?? null} />
      <AppBar title="Store" tabs={<StoreTabs active="rewards" />} />
      <RewardsShop
        data={data}
        balance={balance}
        activeCategory={c}
        categoryHref={(cat) => {
          const q = new URLSearchParams(base);
          if (cat) q.set("c", cat);
          return `/admin-preview/rewards?${q}`;
        }}
      />
    </div>
  );
}
