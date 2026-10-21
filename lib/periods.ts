import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";

// Client-safe (no Prisma): imported by both server queries and client filters.
export const PERIODS = ["month", "quarter", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  month: "This month",
  quarter: "This quarter",
  all: "All time",
};

export function periodRange(
  period: Period,
  ref: Date = new Date(),
): { gte: Date; lte: Date } | undefined {
  if (period === "month") return { gte: startOfMonth(ref), lte: endOfMonth(ref) };
  if (period === "quarter")
    return { gte: startOfQuarter(ref), lte: endOfQuarter(ref) };
  return undefined;
}

/** Whole days left in the period (Duolingo's "3 days left"), null for all-time. */
export function daysLeft(period: Period, ref: Date = new Date()): number | null {
  const range = periodRange(period, ref);
  if (!range) return null;
  return Math.max(0, Math.ceil((range.lte.getTime() - ref.getTime()) / 86_400_000));
}
