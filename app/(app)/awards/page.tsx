import Link from "next/link";
import { Trophy, Vote } from "lucide-react";
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
import { lookOf } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import { VoteSettingsSheet } from "@/components/awards/vote-settings";
import { syncAwardVotesAfterResponse } from "@/lib/votes/run";
import { canRunVote, scheduleSummary, voteTimeLabel } from "@/lib/votes/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Awards" };

export default async function AwardsPage() {
  const me = await requireUser();
  syncAwardVotesAfterResponse();
  const [catalogue, programs, colleagues, recentWins, voteWins, pending] = await Promise.all([
    getCatalogue(),
    prisma.awardProgram.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        voteRounds: {
          where: { status: "open" },
          take: 1,
          select: { id: true, closesAt: true, postId: true, _count: { select: { ballots: true } } },
        },
      },
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
        reviewedAt: true,
      },
    }),
    prisma.awardVoteRound.findMany({
      where: { status: "closed", NOT: { winnerIds: { isEmpty: true } } },
      orderBy: { closedAt: "desc" },
      take: 6,
      select: { id: true, winnerIds: true, closedAt: true, program: { select: { name: true } } },
    }),
    // Review queue: admins see all pending; managers see the pending nominations
    // of everyone who lists them as a manager. Someone with no managers at all
    // only surfaces for admins.
    isManager(me)
      ? prisma.nomination.findMany({
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
      : Promise.resolve([]),
  ]);

  // Winners from nominations and from votes, newest first.
  const voteWinnerIds = [...new Set(voteWins.flatMap((v) => v.winnerIds))];
  const voteWinners = voteWinnerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: voteWinnerIds } },
        select: { id: true, name: true, avatarUrl: true, profile: true },
      })
    : [];
  const winners = [
    ...recentWins.map((w) => ({ key: w.id, at: w.reviewedAt, nominee: w.nominee, program: w.program.name })),
    ...voteWins.flatMap((v) =>
      v.winnerIds.flatMap((id) => {
        const nominee = voteWinners.find((u) => u.id === id);
        return nominee ? [{ key: `${v.id}-${id}`, at: v.closedAt, nominee, program: v.program.name }] : [];
      }),
    ),
  ]
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, 8);

  const colleagueOpts = colleagues.map((c) => ({
    id: c.id,
    name: c.name,
    jobTitle: c.jobTitle,
    avatarUrl: c.avatarUrl,
    siteCode: c.site?.code ?? "",
  }));

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

      {winners.length > 0 && (
        <section className="mb-6 pt-4">
          <h2 className="mb-2 text-[0.95rem] font-bold">Recent winners</h2>
          <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
            {winners.map((w) => (
              <li key={w.key} className="w-20 shrink-0 text-center">
                <Link href={`/profile/${w.nominee.id}`} className="flex flex-col items-center gap-1.5">
                  <span className="relative">
                    <FramedAvatar
                      name={w.nominee.name}
                      avatarUrl={w.nominee.avatarUrl}
                      frame={lookOf(w.nominee.profile, catalogue).frame}
                      className="size-16"
                    />
                    <span className="absolute -right-1 -bottom-1 text-xl">🏆</span>
                  </span>
                  <span className="w-full truncate text-xs font-semibold">{w.nominee.name.split(" ")[0]}</span>
                  <span className="text-muted -mt-1 w-full truncate text-[0.65rem]">{w.program}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className={cn("mb-2 text-[0.95rem] font-bold", winners.length === 0 && pending.length === 0 && "pt-4")}>
        Award programs
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {programs.map((p) => {
          const openRound = p.voteRounds[0] ?? null;
          const schedule = scheduleSummary(p.voteEvery, p.nextVoteAt);
          const voted = Boolean(p.voteEvery) || Boolean(openRound);
          return (
          <article key={p.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500">
                <Trophy className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.05rem] leading-tight font-bold">{p.name}</h3>
                <p className="text-muted mt-0.5 text-[0.82rem]">
                  {voted ? (
                    "Won by staff vote"
                  ) : (
                    <>
                      <span className="capitalize">{p.cadence ?? "Any time"}</span> ·{" "}
                      {p.requiresApproval ? "needs approval" : "instant, from your points to give"}
                    </>
                  )}
                </p>
              </div>
              <span data-numeric className="text-primary shrink-0 text-sm font-bold">
                +{p.points} pts
              </span>
            </div>
            {p.description && <p className="text-muted flex-1 text-[0.9rem] leading-relaxed">{p.description}</p>}
            {openRound ? (
              <Link
                href={openRound.postId ? `/#post-${openRound.postId}` : "/"}
                className="bg-primary/8 text-primary flex items-center gap-2 rounded-xl px-3 py-2.5 text-[0.85rem] font-semibold"
              >
                <Vote className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">Voting open until {voteTimeLabel(openRound.closesAt)}</span>
                <span className="shrink-0">Vote ›</span>
              </Link>
            ) : (
              schedule && (
                <p className="text-muted flex items-center gap-2 text-[0.82rem]">
                  <Vote className="size-4 shrink-0" /> {schedule}
                </p>
              )
            )}
            {voted ? null : (
              <NominateDialog
                program={{
                  id: p.id,
                  name: p.name,
                  points: p.points,
                  requiresApproval: p.requiresApproval,
                }}
                colleagues={colleagueOpts}
              />
            )}
            {canRunVote(me.role, p.voteRole) && (
              <VoteSettingsSheet
                program={{
                  id: p.id,
                  name: p.name,
                  voteEvery: p.voteEvery,
                  voteDays: p.voteDays,
                  nextVoteAt: p.nextVoteAt?.toISOString() ?? null,
                  voteRole: p.voteRole,
                }}
                openRound={
                  openRound
                    ? { closesAt: openRound.closesAt.toISOString(), totalVotes: openRound._count.ballots }
                    : null
                }
              />
            )}
          </article>
          );
        })}
      </div>
    </div>
  );
}
