import { prisma } from "@/lib/prisma";
import { lookOf } from "@/lib/profile-custom";
import type { Cosmetic, FrameArt } from "@/lib/cosmetics";
import type { VoteResult } from "@/lib/votes/run";

export type VotePerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  frame: FrameArt | null;
};

/** What a "vote" feed card needs on top of the post itself. */
export type VoteInfo = {
  roundId: string;
  programName: string;
  programDescription: string | null;
  points: number;
  label: string;
  /** "open", "closing" (time is up, results being counted) or "closed". */
  status: "open" | "closing" | "closed";
  closesAt: string;
  totalVotes: number;
  /** Who the viewer voted for, if they have. */
  myChoice: VotePerson | null;
  /** Closed votes only: the winner(s), and the top of the table. */
  winners: VotePerson[];
  results: { person: VotePerson; votes: number }[];
  pointsEach: number;
};

const personSelect = { id: true, name: true, avatarUrl: true, jobTitle: true, profile: true } as const;

function toPerson(
  u: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null; profile: unknown },
  catalogue: Cosmetic[],
): VotePerson {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, jobTitle: u.jobTitle, frame: lookOf(u.profile, catalogue).frame };
}

/** How many places of a closed vote to show under the winner. */
const RESULTS_SHOWN = 5;

/** Vote details for the given vote posts, keyed by post id. */
export async function getVoteInfo(
  postIds: string[],
  viewerId: string,
  catalogue: Cosmetic[],
): Promise<Map<string, VoteInfo>> {
  const out = new Map<string, VoteInfo>();
  if (postIds.length === 0) return out;

  const rounds = await prisma.awardVoteRound.findMany({
    where: { postId: { in: postIds } },
    include: {
      program: { select: { name: true, description: true, points: true } },
      _count: { select: { ballots: true } },
      ballots: { where: { voterId: viewerId }, select: { nominee: { select: personSelect } } },
    },
  });

  // People named in closed results, fetched once for every card.
  const resultIds = new Set<string>();
  for (const r of rounds) {
    for (const res of parseResults(r.results).slice(0, RESULTS_SHOWN)) resultIds.add(res.userId);
    for (const id of r.winnerIds) resultIds.add(id);
  }
  const people = resultIds.size
    ? await prisma.user.findMany({ where: { id: { in: [...resultIds] } }, select: personSelect })
    : [];
  const byId = new Map(people.map((p) => [p.id, toPerson(p, catalogue)]));

  const now = Date.now();
  for (const r of rounds) {
    if (!r.postId) continue;
    const results = parseResults(r.results);
    out.set(r.postId, {
      roundId: r.id,
      programName: r.program.name,
      programDescription: r.program.description,
      points: r.program.points,
      label: r.label,
      status: r.status === "closed" ? "closed" : r.closesAt.getTime() <= now ? "closing" : "open",
      closesAt: r.closesAt.toISOString(),
      totalVotes: r._count.ballots,
      myChoice: r.ballots[0] ? toPerson(r.ballots[0].nominee, catalogue) : null,
      winners: r.winnerIds.map((id) => byId.get(id)).filter((p): p is VotePerson => Boolean(p)),
      results: results
        .slice(0, RESULTS_SHOWN)
        .map((res) => ({ person: byId.get(res.userId), votes: res.votes }))
        .filter((x): x is { person: VotePerson; votes: number } => Boolean(x.person)),
      pointsEach: r.pointsEach,
    });
  }
  return out;
}

function parseResults(raw: unknown): VoteResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is VoteResult =>
      typeof x === "object" && x !== null && typeof (x as VoteResult).userId === "string" && typeof (x as VoteResult).votes === "number",
  );
}

/** Everyone a viewer can vote for: active colleagues other than themselves. */
export async function getVoteCandidates(viewerId: string, catalogue: Cosmetic[]): Promise<(VotePerson & { siteCode: string })[]> {
  const users = await prisma.user.findMany({
    where: { active: true, siteId: { not: null }, id: { not: viewerId } },
    orderBy: { name: "asc" },
    select: { ...personSelect, site: { select: { code: true } } },
  });
  return users.map((u) => ({ ...toPerson(u, catalogue), siteCode: u.site?.code ?? "" }));
}
