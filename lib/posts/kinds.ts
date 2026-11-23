/**
 * Poll and question posts. Client-safe: no database imports.
 *
 * Who can ask: people whose points rank is Manager, Centre manager,
 * Operations manager or CEO, plus admins. Everyone can vote and answer.
 * The server actions check this again; the UI only hides the buttons.
 */

/** Feed kinds written by one person (not shout-outs). */
export const AUTHORED_KINDS = ["post", "poll", "question"] as const;
export type AuthoredKind = (typeof AUTHORED_KINDS)[number];

/** Ranks that can create polls and questions. */
export const ASKING_RANKS = ["manager", "centre_manager", "operations", "ceo"] as const;

export function canCreatePollsAndQuestions(user: { role: string; pointsRank?: string | null }): boolean {
  if (user.role === "admin") return true;
  return (ASKING_RANKS as readonly string[]).includes(user.pointsRank ?? "");
}

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_OPTION_MAX_LENGTH = 80;
export const QUESTION_MAX_LENGTH = 300;
export const ANSWER_MAX_LENGTH = 1000;

/** How long a poll stays open, offered in the composer. Key is hours; 0 = never closes. */
export const POLL_DURATIONS = [
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
  { hours: 0, label: "No end" },
] as const;
export const DEFAULT_POLL_HOURS = 168;

/** Percent of `total`, rounded, for poll bars. */
export function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}
