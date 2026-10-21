import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isManager, isAdmin } from "@/lib/auth/types";
import { relativeTime } from "@/lib/datetime";
import { AppBar } from "@/components/app-shell/app-bar";
import { NominateDialog } from "@/components/awards/nominate-dialog";
import { NominationActions } from "@/components/awards/nomination-actions";
import { RanksTabs } from "@/components/ranks/ranks-tabs";
import { cn } from "@/lib/utils";
import { FramedAvatar, UserAvatar } from "@/components/user-avatar";
import { parseProfile } from "@/lib/profile-custom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Awards" };

export default async function AwardsPage() {
  const me = await requireUser();

  const [programs, colleagues, recentWins] = await Promise.all([
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
        avatarUrl: true,
        site: { select: { code: true } },
      },
    }),
    prisma.nomination.findMany({
      where: { status: "approved" },
      orderBy: { reviewedAt: "desc" },
      take: 6,
      select: {
        id: true,
        nominee: { select: { id: true, name: true, avatarUrl: true, profile: true } },
        program: { select: { name: true } },
      },
    }),
  ]);

  const colleagueOpts = colleagues.map((c) => ({
    id: c.id,
    name: c.name,
    jobTitle: c.jobTitle,
    avatarUrl: c.avatarUrl,
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
          nominee: { select: { id: true, name: true, avatarUrl: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-xl">
      <AppBar title="Ranks" tabs={<RanksTabs active="awards" />} />

      {isManager(me) && pending.length > 0 && (
        <section className="mb-6 pt-4">
          <h2 className="mb-2 flex items-center gap-2 text-[0.95rem] font-bold">
            Needs your review
            <span data-numeric className="bg-danger rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {pending.map((n) => (
              <li key={n.id} className="border-border space-y-3 rounded-xl border p-3.5">
                <div className="flex items-center gap-3">
                  <UserAvatar name={n.nominee.name} avatarUrl={n.nominee.avatarUrl} className="size-10" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p>
                      <span className="font-semibold">{n.nominee.name}</span>{" "}
                      <span className="text-muted">for</span>{" "}
                      <span className="font-semibold">{n.program.name}</span>
                    </p>
                    <p className="text-muted text-xs">
                      by {n.nominator.name} · {relativeTime(n.createdAt)}
                    </p>
                  </div>
                  <span data-numeric className="text-primary text-sm font-bold">
                    +{n.program.points}
                  </span>
                </div>
                <p className="text-[0.9rem] leading-relaxed">{n.justification}</p>
                <NominationActions id={n.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentWins.length > 0 && (
        <section className="mb-6 pt-4">
          <h2 className="mb-2 text-[0.95rem] font-bold">Recent winners</h2>
          <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
            {recentWins.map((w) => (
              <li key={w.id} className="w-20 shrink-0 text-center">
                <Link href={`/profile/${w.nominee.id}`} className="flex flex-col items-center gap-1.5">
                  <span className="relative">
                    <FramedAvatar
                      name={w.nominee.name}
                      avatarUrl={w.nominee.avatarUrl}
                      frame={parseProfile(w.nominee.profile).frame}
                      className="size-16"
                    />
                    <span className="absolute -right-1 -bottom-1 text-xl">🏆</span>
                  </span>
                  <span className="w-full truncate text-xs font-semibold">{w.nominee.name.split(" ")[0]}</span>
                  <span className="text-muted -mt-1 w-full truncate text-[0.65rem]">{w.program.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className={cn("mb-2 text-[0.95rem] font-bold", recentWins.length === 0 && pending.length === 0 && "pt-4")}>
        Award programs
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {programs.map((p) => (
          <article key={p.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500">
                <Trophy className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.05rem] leading-tight font-bold">{p.name}</h3>
                <p className="text-muted mt-0.5 text-[0.82rem]">
                  <span className="capitalize">{p.cadence ?? "Any time"}</span> ·{" "}
                  {p.requiresApproval ? "needs approval" : "instant"}
                </p>
              </div>
              <span data-numeric className="text-primary shrink-0 text-sm font-bold">
                +{p.points} pts
              </span>
            </div>
            {p.description && <p className="text-muted flex-1 text-[0.9rem] leading-relaxed">{p.description}</p>}
            <NominateDialog
              program={{
                id: p.id,
                name: p.name,
                points: p.points,
                requiresApproval: p.requiresApproval,
              }}
              colleagues={colleagueOpts}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
