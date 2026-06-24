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
    },
  });

  const rows: ProgramRow[] = programs;

  return (
    <div>
      <PageHeader
        title="Award programs"
        description="Configure nomination-based award programs."
      />
      <AwardProgramsManager rows={rows} />
    </div>
  );
}
