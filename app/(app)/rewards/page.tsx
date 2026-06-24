import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      orderBy: [{ pointsCost: "asc" }],
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
    <div>
      <PageHeader
        title="Rewards"
        description="Spend your points on internal perks and rewards."
        action={
          <Button asChild variant="outline">
            <Link href="/me">
              <Wallet className="size-4" />
              <span data-numeric>{formatNumber(user.walletBalance)}</span> pts
            </Link>
          </Button>
        }
      />

      {rewards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted py-16 text-center text-sm">
            No rewards available right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
