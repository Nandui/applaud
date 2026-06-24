import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isManager, isAdmin } from "@/lib/auth/types";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { NominateDialog } from "@/components/awards/nominate-dialog";
import { NominationActions } from "@/components/awards/nomination-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Awards" };

export default async function AwardsPage() {
  const me = await requireUser();

  const [programs, colleagues] = await Promise.all([
    prisma.awardProgram.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, id: { not: me.id } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        site: { select: { code: true } },
      },
    }),
  ]);

  const colleagueOpts = colleagues.map((c) => ({
    id: c.id,
    name: c.name,
    jobTitle: c.jobTitle,
    siteCode: c.site.code,
  }));

  // Review queue: admins see all pending; managers see their reports' pending.
  const pending = isManager(me)
    ? await prisma.nomination.findMany({
        where: {
          status: "pending",
          ...(isAdmin(me) ? {} : { nominee: { managerId: me.id } }),
        },
        orderBy: { createdAt: "asc" },
        include: {
          program: { select: { name: true, points: true } },
          nominator: { select: { name: true } },
          nominee: { select: { id: true, name: true } },
        },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Awards"
        description="Browse award programs and nominate a colleague."
      />

      {isManager(me) && pending.length > 0 && (
        <Card className="border-warning/40 mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Nominations to review ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((n) => (
              <div
                key={n.id}
                className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{n.nominee.name}</span>{" "}
                    <span className="text-muted">for</span>{" "}
                    <span className="font-semibold">{n.program.name}</span>{" "}
                    <span
                      data-numeric
                      className="text-success bg-success/10 ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    >
                      +{n.program.points}
                    </span>
                  </p>
                  <p className="text-muted text-xs">
                    Nominated by {n.nominator.name} · {relativeTime(n.createdAt)}
                  </p>
                  <p className="mt-1 text-sm">{n.justification}</p>
                </div>
                <div className="shrink-0">
                  <NominationActions id={n.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold">{p.name}</h3>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {p.cadence ?? "Ad hoc"}
                  </Badge>
                </div>
                <span
                  data-numeric
                  className="text-success bg-success/10 rounded-full px-2 py-0.5 text-xs font-semibold"
                >
                  +{p.points} pts
                </span>
              </div>
              {p.description && (
                <p className="text-muted flex-1 text-sm">{p.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted text-xs">
                  {p.requiresApproval ? "Needs approval" : "Instant award"}
                </span>
                <NominateDialog
                  program={{
                    id: p.id,
                    name: p.name,
                    points: p.points,
                    requiresApproval: p.requiresApproval,
                  }}
                  colleagues={colleagueOpts}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
