import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  AwardProgramsManager,
  type ProgramRow,
} from "@/components/admin/award-programs-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Award programs" };

export default async function AdminAwardsPage() {
  await requireAdmin();

  const programs = await prisma.awardProgram.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      points: true,
      cadence: true,
      requiresApproval: true,
      active: true,
      voteEvery: true,
      voteDays: true,
      voteRole: true,
      nextVoteAt: true,
    },
  });

  const rows: ProgramRow[] = programs.map((p) => ({
    ...p,
    nextVoteAt: p.nextVoteAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Award programs"
        description="Awards won by nomination, or put to a staff vote on a schedule."
      />
      <AwardProgramsManager rows={rows} />
    </div>
  );
}
