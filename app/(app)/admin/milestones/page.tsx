import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { CELEBRATION_LABELS } from "@/lib/profile";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MilestonesManager,
  type RuleRow,
} from "@/components/admin/milestones-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Milestones" };

export default async function AdminMilestonesPage() {
  await requireAdmin();

  const [rules, celebrations] = await Promise.all([
    prisma.milestoneRule.findMany({ orderBy: { type: "asc" } }),
    prisma.celebration.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const ruleRows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    type: r.type,
    points: r.points,
    active: r.active,
    config: (r.config ?? {}) as Record<string, unknown>,
  }));

  return (
    <div>
      <PageHeader
        title="Milestones"
        description="Automatically celebrate birthdays. Work anniversaries and onboarding are paused — switch them on to resume."
      />

      <MilestonesManager rules={ruleRows} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent celebrations</CardTitle>
        </CardHeader>
        <CardContent>
          {celebrations.length === 0 ? (
            <p className="text-muted py-6 text-center text-sm">
              No celebrations yet. Run the job to generate today&apos;s.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {celebrations.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span>
                    <span className="font-medium">{c.user.name}</span>{" "}
                    <span className="text-muted">
                      · {CELEBRATION_LABELS[c.type] ?? c.type}
                    </span>
                  </span>
                  <span className="text-muted text-xs">
                    {relativeTime(c.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
