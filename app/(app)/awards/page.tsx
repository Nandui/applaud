import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isManager, isAdmin } from "@/lib/auth/types";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { NominateDialog } from "@/components/awards/nominate-dialog";
import { NominationActions } from "@/components/awards/nomination-actions";
import { BackButton } from "@/components/app-shell/back-button";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
    siteCode: c.site?.code ?? "",
  }));

  // Review queue: admins see all pending; managers see the pending nominations
  // of everyone who lists them as a manager. Someone with no managers at all
  // only surfaces for admins.
  const pending = isManager(me)
    ? await prisma.nomination.findMany({
        where: {
          status: "pending",
          ...(isAdmin(me)
            ? {}
            : { nominee: { managers: { some: { managerId: me.id } } } }),
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Awards"
        description="Browse award programs and nominate a colleague."
        leading={<BackButton />}
      />

      {isManager(me) && pending.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display mb-2 flex items-center gap-2 px-1 text-lg font-semibold">
            Needs your review
            <span data-numeric className="bg-danger rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          </h2>
          <ul className="bg-surface divide-border divide-y overflow-hidden rounded-3xl">
            {pending.map((n) => (
              <li key={n.id} className="space-y-2 p-4">
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
                <p className="bg-secondary rounded-2xl px-3 py-2 text-sm">{n.justification}</p>
                <NominationActions id={n.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {programs.map((p, i) => (
          <article key={p.id} className="bg-surface flex flex-col overflow-hidden rounded-3xl">
            <div
              className={cn(
                "relative flex h-28 items-end p-4 text-white",
                i % 3 === 0 ? "bg-brand" : i % 3 === 1 ? "bg-gradient-to-br from-indigo-500 to-cyan-400" : "bg-gradient-to-br from-amber-400 to-rose-500",
              )}
            >
              <Trophy className="absolute top-3 right-3 size-16 opacity-20" aria-hidden />
              <div>
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold capitalize backdrop-blur">
                  {p.cadence ?? "Ad hoc"}
                </span>
                <h3 className="font-display mt-1.5 text-xl leading-tight font-semibold">{p.name}</h3>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-center gap-2 text-xs">
                <span
                  data-numeric
                  className="text-success bg-success/10 rounded-full px-2 py-0.5 font-semibold"
                >
                  +{p.points} pts
                </span>
                <span className="text-muted">
                  {p.requiresApproval ? "Needs approval" : "Instant award"}
                </span>
              </div>
              {p.description && (
                <p className="text-muted flex-1 text-sm">{p.description}</p>
              )}
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
          </article>
        ))}
      </div>
    </div>
  );
}
