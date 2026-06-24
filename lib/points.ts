import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

type AllowanceSettings = {
  monthlyAllowanceStaff: number;
  monthlyAllowanceManager: number;
};

type TxClient = Pick<typeof prisma, "recognitionRecipient" | "rewardLedger" | "user">;

/**
 * The GIVING allowance for a role. Staff get the staff allowance; managers and
 * admins get the (higher) manager allowance. This is the budget for
 * recognising others — it resets monthly and is never redeemable.
 */
export function allowanceForRole(role: string, settings: AllowanceSettings): number {
  return role === "staff"
    ? settings.monthlyAllowanceStaff
    : settings.monthlyAllowanceManager;
}

/**
 * Points the user has spent from their allowance in the current month =
 * SUM(RecognitionRecipient.points) across recognitions they sent this month.
 */
export async function getMonthlyAllowanceUsage(
  userId: string,
  ref: Date = new Date(),
  client: Pick<typeof prisma, "recognitionRecipient"> = prisma,
): Promise<number> {
  const agg = await client.recognitionRecipient.aggregate({
    _sum: { points: true },
    where: {
      points: { gt: 0 },
      recognition: {
        senderId: userId,
        createdAt: { gte: startOfMonth(ref), lte: endOfMonth(ref) },
      },
    },
  });
  return agg._sum.points ?? 0;
}

export type AllowanceStatus = {
  total: number;
  used: number;
  remaining: number;
};

export async function getAllowanceStatus(
  user: { id: string; role: string },
  settings: AllowanceSettings,
  ref: Date = new Date(),
): Promise<AllowanceStatus> {
  const total = allowanceForRole(user.role, settings);
  const used = await getMonthlyAllowanceUsage(user.id, ref);
  return { total, used, remaining: Math.max(0, total - used) };
}

/**
 * Recompute a user's cached wallet balance from the ledger (the source of
 * truth) and write it back. Pass a transaction client to keep it atomic with
 * ledger writes. Returns the recomputed balance.
 */
export async function recomputeWalletBalance(
  userId: string,
  client: TxClient = prisma,
): Promise<number> {
  const agg = await client.rewardLedger.aggregate({
    _sum: { amount: true },
    where: { userId },
  });
  const balance = agg._sum.amount ?? 0;
  await client.user.update({
    where: { id: userId },
    data: { walletBalance: balance },
  });
  return balance;
}
