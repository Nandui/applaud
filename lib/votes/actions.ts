"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { getCatalogue } from "@/lib/catalogue";
import { closeVoteRound, openVoteRound } from "@/lib/votes/run";
import { getVoteCandidates, type VotePerson } from "@/lib/votes/queries";
import { parseVoteSchedule } from "@/lib/votes/form";
import { canRunVote, scheduleSummary } from "@/lib/votes/schedule";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/admin/awards");
}

/** Vote, or change your vote, while the vote is open. Votes are secret. */
export async function castVote(roundId: string, nomineeId: string): Promise<ActionResult> {
  const me = await requireUser();
  if (nomineeId === me.id) return { ok: false, error: "You can't vote for yourself." };

  const [round, nominee] = await Promise.all([
    prisma.awardVoteRound.findUnique({ where: { id: roundId }, select: { status: true, closesAt: true } }),
    prisma.user.findFirst({ where: { id: nomineeId, active: true, siteId: { not: null } }, select: { name: true } }),
  ]);
  if (!round || round.status !== "open" || round.closesAt.getTime() <= Date.now()) {
    return { ok: false, error: "This vote has closed." };
  }
  if (!nominee) return { ok: false, error: "That colleague is unavailable." };

  await prisma.awardBallot.upsert({
    where: { roundId_voterId: { roundId, voterId: me.id } },
    create: { roundId, voterId: me.id, nomineeId },
    update: { nomineeId },
  });
  revalidatePath("/");
  return { ok: true, message: `You voted for ${nominee.name}.` };
}

/** The people to pick from in the vote sheet (loaded when it opens). */
export async function loadVoteCandidates(): Promise<(VotePerson & { siteCode: string })[]> {
  const me = await requireUser();
  return getVoteCandidates(me.id, await getCatalogue());
}

async function loadRunnable(programId: string) {
  const me = await requireUser();
  const program = await prisma.awardProgram.findUnique({
    where: { id: programId },
    select: { id: true, name: true, active: true, voteRole: true },
  });
  if (!program) return { me, program: null, error: "That award no longer exists." } as const;
  if (!canRunVote(me.role, program.voteRole)) {
    return { me, program: null, error: "You can't run this award's vote." } as const;
  }
  return { me, program, error: null } as const;
}

/**
 * Set how often an award is put to a vote. Open to admins and to the award's
 * vote role (e.g. managers, or the CEO for a CEO's award).
 */
export async function saveVoteSchedule(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { me, program, error } = await loadRunnable(String(formData.get("programId") ?? ""));
  if (!program) return { ok: false, error };
  const parsed = parseVoteSchedule(formData);
  if (!parsed.ok) return parsed;

  await prisma.awardProgram.update({
    where: { id: program.id },
    data: { ...parsed.data, voteSetById: me.id },
  });
  await writeAudit({
    actor: me,
    action: "vote.scheduled",
    entityType: "award_program",
    entityId: program.id,
    summary: parsed.data.voteEvery
      ? `Set the ${program.name} vote: ${scheduleSummary(parsed.data.voteEvery, parsed.data.nextVoteAt)}, open ${parsed.data.voteDays} days`
      : `Turned off the ${program.name} vote`,
    metadata: {
      voteEvery: parsed.data.voteEvery,
      voteDays: parsed.data.voteDays,
      nextVoteAt: parsed.data.nextVoteAt?.toISOString() ?? null,
    },
  });
  refresh();
  return { ok: true, message: parsed.data.voteEvery ? "Vote schedule saved." : "Voting turned off." };
}

/** Open a vote on an award right now, outside its schedule. */
export async function openVoteNow(programId: string): Promise<ActionResult> {
  const { me, program, error } = await loadRunnable(programId);
  if (!program) return { ok: false, error };
  if (!program.active) return { ok: false, error: "Turn the award on first." };
  const opened = await openVoteRound(program.id, { openedBy: me });
  if (!opened) return { ok: false, error: "This award already has a vote open." };
  refresh();
  return { ok: true, message: "Vote opened. It's in the feed now." };
}

/** Close an award's open vote early and announce the winner. */
export async function closeVoteNow(programId: string): Promise<ActionResult> {
  const { me, program, error } = await loadRunnable(programId);
  if (!program) return { ok: false, error };
  const open = await prisma.awardVoteRound.findFirst({
    where: { programId: program.id, status: "open" },
    select: { id: true },
  });
  if (!open) return { ok: false, error: "There's no open vote to close." };
  const closed = await closeVoteRound(open.id, { closedBy: me });
  if (!closed) return { ok: false, error: "That vote has already closed." };
  refresh();
  return {
    ok: true,
    message: closed.winners.length === 0 ? "Vote closed. Nobody voted." : "Vote closed. The winner is in the feed.",
  };
}
