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
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        pointsCost: true,
        stock: true,
        siteId: true,
        active: true,
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
        description="Manage the reward catalogue, pricing, and stock."
      />
      <RewardsManager rows={rows} sites={sites} />
    </div>
  );
}
