import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/datetime";
import { expectedByLabel, isOverdue } from "@/lib/fulfilment";
import { PageHeader } from "@/components/page-header";
import {
  RedemptionsManager,
  type RedemptionRow,
} from "@/components/admin/redemptions-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redemptions" };

export default async function AdminRedemptionsPage() {
  await requireAdmin();

  const redemptions = await prisma.redemption.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      reward: { select: { name: true, fulfilmentUnit: true } },
    },
  });

  // fulfilledById has no FK relation in the schema — resolve names by lookup.
  const fulfillerIds = [
    ...new Set(redemptions.map((r) => r.fulfilledById).filter(Boolean)),
  ] as string[];
  const fulfillers = fulfillerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: fulfillerIds } },
        select: { id: true, name: true },
      })
    : [];
  const fulfillerMap = new Map(fulfillers.map((u) => [u.id, u.name]));

  const now = new Date();
  const rows: RedemptionRow[] = redemptions.map((r) => ({
    id: r.id,
    status: r.status,
    pointsCost: r.pointsCost,
    createdAtLabel: relativeTime(r.createdAt),
    userId: r.user.id,
    userName: r.user.name,
    rewardName: r.reward.name,
    expectedAt: r.expectedBy?.getTime() ?? null,
    expectedLabel: r.expectedBy ? expectedByLabel(r.expectedBy, r.reward.fulfilmentUnit === "hours") : null,
    overdue: isOverdue(r, now),
    staffNote: r.staffNote,
    fulfilledByName: r.fulfilledById
      ? (fulfillerMap.get(r.fulfilledById) ?? null)
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="Redemptions"
        description="Fulfilment queue. Move each claim from Requested to In progress to Fulfilled; staff follow it in My rewards. Add a note to tell them how or where to collect it. Cancelling refunds the points."
      />
      <RedemptionsManager rows={rows} />
    </div>
  );
}
