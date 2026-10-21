import { prisma } from "@/lib/prisma";
import { economyMonth, maxPointsPerShoutout, resetsInLabel } from "@/lib/economy";

type AllowanceSettings = {
  monthlyAllowanceStaff: number;
  monthlyAllowanceManager: number;
  maxPointsPerShoutoutStaff: number;
  maxPointsPerShoutoutManager: number;
};

type TxClient = Pick<typeof prisma, "recognitionRecipient" | "rewardLedger" | "user">;
type UsageClient = Pick<typeof prisma, "recognitionRecipient" | "nomination">;

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
 * Points the user has spent from their allowance in the current month (Irish
 * time) = points on recognitions they sent, plus instant awards (programs with
 * no approval step, e.g. Spot Award) they gave. Anything left on the last day
 * simply isn't counted next month, which is the month-end reset.
 */
export async function getMonthlyAllowanceUsage(
  userId: string,
  ref: Date = new Date(),
  client: UsageClient = prisma,
): Promise<number> {
  const month = economyMonth(ref);
  const [shoutouts, instantAwards] = await Promise.all([
    client.recognitionRecipient.aggregate({
      _sum: { points: true },
      where: {
        points: { gt: 0 },
        recognition: { senderId: userId, createdAt: month },
      },
    }),
    client.nomination.aggregate({
      _sum: { pointsAwarded: true },
      where: {
        nominatorId: userId,
        status: "approved",
        program: { requiresApproval: false },
        createdAt: month,
      },
    }),
  ]);
  return (shoutouts._sum.points ?? 0) + (instantAwards._sum.pointsAwarded ?? 0);
}

/**
 * Bonus-pool points handed out this month: boosts (net of removals) and
 * AWARD rows (approved awards and milestones), none of which come out of
 * anyone's allowance. Instant awards are paid from the nominator's allowance
 * instead, so they're excluded here.
 */
export async function getMonthlyBonusUsage(
  ref: Date = new Date(),
  client: Pick<typeof prisma, "rewardLedger" | "nomination"> = prisma,
): Promise<number> {
  const month = economyMonth(ref);
  const [ledger, instant] = await Promise.all([
    client.rewardLedger.aggregate({
      _sum: { amount: true },
      where: { type: { in: ["BOOST", "AWARD"] }, createdAt: month },
    }),
    client.nomination.aggregate({
      _sum: { pointsAwarded: true },
      where: { status: "approved", program: { requiresApproval: false }, createdAt: month },
    }),
  ]);
  return Math.max(0, (ledger._sum.amount ?? 0) - (instant._sum.pointsAwarded ?? 0));
}

export type AllowanceStatus = {
  total: number;
  used: number;
  remaining: number;
  /** Most points per person on one shout-out; 0 = no limit. */
  perShoutoutMax: number;
  /** "resets in 9 days" */
  resetsIn: string;
};

export async function getAllowanceStatus(
  user: { id: string; role: string },
  settings: AllowanceSettings,
  ref: Date = new Date(),
): Promise<AllowanceStatus> {
  const total = allowanceForRole(user.role, settings);
  const used = await getMonthlyAllowanceUsage(user.id, ref);
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    perShoutoutMax: maxPointsPerShoutout(user.role, settings),
    resetsIn: resetsInLabel(ref),
  };
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
