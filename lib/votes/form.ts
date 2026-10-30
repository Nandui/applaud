import {
  MAX_VOTE_DAYS,
  MIN_VOTE_DAYS,
  firstOpening,
  isVoteInterval,
  parseOpeningDate,
  type VoteInterval,
} from "@/lib/votes/schedule";

/** The longest a vote can stay open, so it closes before the next one opens. */
export function maxVoteDays(every: VoteInterval | null): number {
  return every === "week" ? 7 : MAX_VOTE_DAYS;
}

export type VoteSchedule = {
  voteEvery: VoteInterval | null;
  voteDays: number;
  nextVoteAt: Date | null;
};

/**
 * Read the vote fields shared by Admin > Awards and the vote settings sheet:
 * voteEvery ("off" or an interval), voteDays, and nextVoteOn (a date; blank
 * means the start of the next week, month or quarter).
 */
export function parseVoteSchedule(
  fd: FormData,
  now: Date = new Date(),
): { ok: true; data: VoteSchedule } | { ok: false; error: string } {
  const everyRaw = String(fd.get("voteEvery") ?? "off");
  const voteEvery = isVoteInterval(everyRaw) ? everyRaw : null;
  const days = Math.floor(Number(fd.get("voteDays") ?? 7));
  const maxDays = maxVoteDays(voteEvery);
  if (!Number.isFinite(days) || days < MIN_VOTE_DAYS || days > maxDays) {
    return { ok: false, error: `A vote stays open between ${MIN_VOTE_DAYS} and ${maxDays} days.` };
  }
  if (!voteEvery) return { ok: true, data: { voteEvery: null, voteDays: days, nextVoteAt: null } };

  const dateRaw = String(fd.get("nextVoteOn") ?? "").trim();
  let nextVoteAt = dateRaw ? parseOpeningDate(dateRaw) : firstOpening(voteEvery, now);
  if (!nextVoteAt) return { ok: false, error: "Pick the date the next vote opens." };
  // Today's date after 09:00 means "open it now": the next sync picks it up.
  if (nextVoteAt.getTime() < now.getTime() - 86_400_000) {
    return { ok: false, error: "The next vote can't open in the past." };
  }
  if (nextVoteAt.getTime() < now.getTime()) nextVoteAt = now;
  return { ok: true, data: { voteEvery, voteDays: days, nextVoteAt } };
}
