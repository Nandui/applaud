import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { writeAudit, type AuditActor } from "@/lib/audit";
import { getOrgSettings } from "@/lib/org-settings";
import { getMonthlyBonusUsage } from "@/lib/points";
import { lockPool } from "@/lib/locks";
import { isVoteInterval, nextOpening, roundLabel, voteTimeLabel } from "@/lib/votes/schedule";

export type VoteResult = { userId: string; votes: number };

const DAY_MS = 86_400_000;

/**
 * The person a vote post goes out under: whoever opened it by hand, else the
 * person who set the schedule (if still active), else the first admin.
 */
async function postAuthor(preferredId: string | null | undefined): Promise<string | null> {
  if (preferredId) {
    const u = await prisma.user.findFirst({ where: { id: preferredId, active: true }, select: { id: true } });
    if (u) return u.id;
  }
  const admin = await prisma.user.findFirst({
    where: { role: "admin", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

/**
 * Open a vote on an award and post it to the feed. Refuses (returns null) when
 * the award already has an open vote, so a double press or two overlapping
 * syncs open it once.
 */
export async function openVoteRound(
  programId: string,
  opts: { openedBy?: AuditActor | null; now?: Date } = {},
): Promise<{ roundId: string } | null> {
  const now = opts.now ?? new Date();
  const program = await prisma.awardProgram.findUnique({ where: { id: programId } });
  if (!program || !program.active) return null;
  const authorId = await postAuthor(opts.openedBy?.id ?? program.voteSetById);
  if (!authorId) return null;

  const every = isVoteInterval(program.voteEvery) ? program.voteEvery : null;
  const label = roundLabel(now, every);
  const closesAt = new Date(now.getTime() + Math.max(1, program.voteDays) * DAY_MS);

  const round = await prisma.$transaction(async (tx) => {
    // Serialise openers for this award (Postgres advisory lock on its id).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vote:${programId}`})::bigint)`;
    const open = await tx.awardVoteRound.findFirst({ where: { programId, status: "open" }, select: { id: true } });
    if (open) return null;

    const post = await tx.recognition.create({
      data: {
        kind: "vote",
        system: true,
        senderId: authorId,
        visibility: "public",
        imageUrls: [],
        message: `🗳️ Vote for ${program.name} · ${label}. Voting closes ${voteTimeLabel(closesAt)}.`,
      },
    });
    return tx.awardVoteRound.create({
      data: { programId, label, opensAt: now, closesAt, postId: post.id },
    });
  });
  if (!round) return null;

  await writeAudit({
    actor: opts.openedBy ?? null,
    action: "vote.opened",
    entityType: "award_vote",
    entityId: round.id,
    summary: `Opened the ${program.name} vote (${label})${opts.openedBy ? "" : " on schedule"}`,
    metadata: { programId, closesAt: closesAt.toISOString() },
  });
  return { roundId: round.id };
}

type Tx = Prisma.TransactionClient;

/** Tally a round's ballots, most votes first, ignoring people since removed. */
async function tally(tx: Tx, roundId: string): Promise<VoteResult[]> {
  const groups = await tx.awardBallot.groupBy({
    by: ["nomineeId"],
    where: { roundId, nominee: { active: true } },
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ userId: g.nomineeId, votes: g._count._all }))
    .sort((a, b) => b.votes - a.votes);
}

/**
 * Close a vote: count it, name the winner(s) (a tie shares the award), pay
 * each winner the award's points from the monthly bonus pool and post the
 * result to the feed. Safe to call twice: only the first call closes it.
 */
export async function closeVoteRound(
  roundId: string,
  opts: { closedBy?: AuditActor | null; now?: Date } = {},
): Promise<{ winners: string[]; pointsEach: number } | null> {
  const now = opts.now ?? new Date();
  const settings = await getOrgSettings();

  const outcome = await prisma.$transaction(async (tx) => {
    // Claim the round; a second closer finds it already closed.
    const claimed = await tx.awardVoteRound.updateMany({
      where: { id: roundId, status: "open" },
      data: { status: "closed", closedAt: now },
    });
    if (claimed.count === 0) return null;

    const round = await tx.awardVoteRound.findUniqueOrThrow({
      where: { id: roundId },
      include: {
        program: { select: { id: true, name: true, points: true } },
        post: { select: { senderId: true } },
      },
    });
    const results = await tally(tx, roundId);
    const top = results[0]?.votes ?? 0;
    const winnerIds = top > 0 ? results.filter((r) => r.votes === top).map((r) => r.userId) : [];

    let pointsEach = 0;
    let poolShort = false;
    if (winnerIds.length > 0 && round.program.points > 0) {
      await lockPool(tx, "bonusPool");
      const used = await getMonthlyBonusUsage(now, tx);
      if (used + round.program.points * winnerIds.length <= settings.monthlyBonusPool) {
        pointsEach = round.program.points;
      } else {
        poolShort = true;
      }
    }

    if (winnerIds.length > 0) {
      const winners = await tx.user.findMany({ where: { id: { in: winnerIds } }, select: { id: true, name: true } });
      const names = winnerIds.map((id) => winners.find((w) => w.id === id)?.name ?? "Someone");
      const nameList =
        names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
      const senderId = round.post?.senderId ?? (await postAuthor(null));
      if (senderId) {
        await tx.recognition.create({
          data: {
            senderId,
            system: true,
            imageUrls: [],
            message: `🏆 ${nameList} won the ${round.program.name} vote (${round.label}) with ${top} ${top === 1 ? "vote" : "votes"}!`,
            recipients: { create: winnerIds.map((userId) => ({ userId, points: 0 })) },
          },
        });
      }
      if (pointsEach > 0) {
        for (const userId of winnerIds) {
          await tx.rewardLedger.create({
            data: {
              userId,
              amount: pointsEach,
              type: "AWARD",
              sourceType: "award_vote",
              sourceId: round.id,
              note: `Won the ${round.program.name} vote (${round.label})`,
            },
          });
          await tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: pointsEach } } });
        }
      }
    }

    await tx.awardVoteRound.update({
      where: { id: roundId },
      data: { results: results as unknown as Prisma.InputJsonValue, winnerIds, pointsEach },
    });
    return { program: round.program, label: round.label, winnerIds, pointsEach, poolShort, total: results.reduce((n, r) => n + r.votes, 0) };
  });
  if (!outcome) return null;

  await writeAudit({
    actor: opts.closedBy ?? null,
    action: "vote.closed",
    entityType: "award_vote",
    entityId: roundId,
    summary:
      outcome.winnerIds.length === 0
        ? `Closed the ${outcome.program.name} vote (${outcome.label}) with no votes`
        : `Closed the ${outcome.program.name} vote (${outcome.label}): ${outcome.winnerIds.length} winner(s), ${outcome.total} votes${outcome.poolShort ? ", no points (bonus pool used up)" : ""}`,
    metadata: {
      programId: outcome.program.id,
      winnerIds: outcome.winnerIds,
      pointsEach: outcome.pointsEach,
      poolShort: outcome.poolShort,
      early: Boolean(opts.closedBy),
    },
  });
  return { winners: outcome.winnerIds, pointsEach: outcome.pointsEach };
}

/**
 * Close every vote whose time is up and open every vote that's due. Run by
 * the daily cron and, after the response, by the feed and Awards pages, so
 * votes open and close close to on time without a frequent cron.
 */
export async function syncAwardVotes(now: Date = new Date()): Promise<{ opened: number; closed: number }> {
  let opened = 0;
  let closed = 0;

  const due = await prisma.awardVoteRound.findMany({
    where: { status: "open", closesAt: { lte: now } },
    select: { id: true },
  });
  for (const r of due) {
    if (await closeVoteRound(r.id, { now })) closed += 1;
  }

  const programs = await prisma.awardProgram.findMany({
    where: { active: true, voteEvery: { not: null }, nextVoteAt: { lte: now } },
    select: { id: true, voteEvery: true, nextVoteAt: true },
  });
  for (const p of programs) {
    if (!isVoteInterval(p.voteEvery) || !p.nextVoteAt) continue;
    // Move the schedule on first; only the request that moves it opens the vote.
    const moved = await prisma.awardProgram.updateMany({
      where: { id: p.id, nextVoteAt: p.nextVoteAt },
      data: { nextVoteAt: nextOpening(p.nextVoteAt, p.voteEvery, now) },
    });
    if (moved.count === 0) continue;
    if (await openVoteRound(p.id, { now })) opened += 1;
  }

  return { opened, closed };
}

/** Run syncAwardVotes once this response has gone out (feed and Awards pages). */
export function syncAwardVotesAfterResponse(): void {
  after(async () => {
    try {
      await syncAwardVotes();
    } catch (err) {
      console.error("[votes] sync failed", err);
    }
  });
}
