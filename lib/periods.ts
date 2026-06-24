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
