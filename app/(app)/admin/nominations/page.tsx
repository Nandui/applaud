import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import {
  NominationsManager,
  type NominationRow,
} from "@/components/admin/nominations-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nominations" };

export default async function AdminNominationsPage() {
  await requireAdmin();

  const nominations = await prisma.nomination.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      program: { select: { name: true, points: true } },
      nominee: { select: { id: true, name: true } },
      nominator: { select: { name: true } },
    },
  });

  const reviewerIds = [
    ...new Set(nominations.map((n) => n.reviewedById).filter(Boolean)),
  ] as string[];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true },
      })
    : [];
  const reviewerMap = new Map(reviewers.map((u) => [u.id, u.name]));

  const rows: NominationRow[] = nominations.map((n) => ({
    id: n.id,
    status: n.status,
    programName: n.program.name,
    programPoints: n.program.points,
    nomineeId: n.nominee.id,
    nomineeName: n.nominee.name,
    nominatorName: n.nominator.name,
    justification: n.justification,
    createdAtLabel: relativeTime(n.createdAt),
    reviewedByName: n.reviewedById
      ? (reviewerMap.get(n.reviewedById) ?? null)
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="Nominations"
        description="Review nominations org-wide — approve to credit the nominee and post to the feed."
      />
      <NominationsManager rows={rows} />
    </div>
  );
}
