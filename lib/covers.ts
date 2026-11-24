/**
 * Thanks for covering at short notice: a manager (or any rank above) gives
 * points to someone who stepped in for a lesson, an activity or a shift at the
 * last minute. Stored as a Recognition with kind "cover" and paid from a
 * SEPARATE monthly cover allowance per rank, never the normal giving
 * allowance. Covers have their own "Most helpful" leaderboard and their own
 * ledger type (COVER), so they never inflate shout-out counts.
 *
 * Client-safe: no database imports.
 */

import type { PointsRank } from "@/lib/ranks";

/** Ranks that can thank people for covering, in display order. */
export const COVER_RANKS = ["manager", "centre_manager", "operations", "ceo"] as const;
export type CoverRank = (typeof COVER_RANKS)[number];

/** The OrgSettings column holding each rank's monthly cover allowance. */
export const COVER_ALLOWANCE_FIELD = {
  manager: "coverAllowanceManager",
  centre_manager: "coverAllowanceCentreManager",
  operations: "coverAllowanceOperations",
  ceo: "coverAllowanceCeo",
} as const satisfies Record<CoverRank, string>;

export type CoverAllowanceField = (typeof COVER_ALLOWANCE_FIELD)[CoverRank];
export type CoverAllowances = Record<CoverAllowanceField, number>;

export function isCoverRank(rank: string | null | undefined): rank is CoverRank {
  return (COVER_RANKS as readonly string[]).includes(rank ?? "");
}

/** Can this person thank others for covering? Decided by points rank only. */
export function canThankForCovers(user: { pointsRank?: string | null }): boolean {
  return isCoverRank(user.pointsRank);
}

/** The monthly cover allowance for a rank: 0 for Staff and Backoffice. */
export function coverAllowanceForRank(rank: string | null | undefined, settings: CoverAllowances): number {
  return isCoverRank(rank) ? settings[COVER_ALLOWANCE_FIELD[rank]] : 0;
}

/** Cover allowance per rank for every points rank (0 where there is none). */
export function coverAllowanceByRank(settings: CoverAllowances): Record<PointsRank, number> {
  return {
    staff: 0,
    backoffice: 0,
    manager: settings.coverAllowanceManager,
    centre_manager: settings.coverAllowanceCentreManager,
    operations: settings.coverAllowanceOperations,
    ceo: settings.coverAllowanceCeo,
  };
}

export const COVER_TYPES = ["lesson", "activity", "shift"] as const;
export type CoverType = (typeof COVER_TYPES)[number];

export const COVER_TYPE_LABELS: Record<CoverType, string> = {
  lesson: "Lesson",
  activity: "Activity",
  shift: "Shift",
};

export function isCoverType(value: string | null | undefined): value is CoverType {
  return (COVER_TYPES as readonly string[]).includes(value ?? "");
}

/** Longest "which one" description, e.g. "Sat 10am Level 3 swim". */
export const COVER_WHAT_MAX = 80;

/** "Covered a lesson", "Covered a shift", "Covered an activity". */
export function coveredPhrase(type: string | null | undefined): string {
  if (!isCoverType(type)) return "Covered at short notice";
  return type === "activity" ? "Covered an activity" : `Covered a ${type}`;
}

/**
 * The quick amounts on the cover keypad: the suggested amount first, then
 * half and double it, kept under the per-cover limit and without repeats.
 */
export function coverPresets(suggested: number, max: number): number[] {
  const base = Math.max(10, suggested);
  const raw = [Math.round(base / 2 / 10) * 10, base, base * 2];
  const capped = raw.map((n) => (max > 0 ? Math.min(n, max) : n)).filter((n) => n > 0);
  return [...new Set(capped)].sort((a, b) => a - b);
}
