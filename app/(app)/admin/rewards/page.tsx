import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  RewardsManager,
  type RewardRow,
} from "@/components/admin/rewards-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  await requireAdmin();

  const [rewards, sites] = await Promise.all([
    prisma.reward.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        category: true,
        pointsCost: true,
        stock: true,
        siteId: true,
        active: true,
        fulfilment: true,
        type: true,
        sortOrder: true,
      },
    }),
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: RewardRow[] = rewards;

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Create and edit what staff can redeem. Changes appear on the Rewards store immediately. Hide an offering instead of deleting it."
      />
      <RewardsManager rows={rows} sites={sites} />
    </div>
  );
}
