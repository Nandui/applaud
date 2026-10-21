import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Transaction-scoped Postgres advisory locks for the monthly pools. Taking the
 * lock first makes "read this month's total, then add to it" atomic across
 * concurrent requests; the lock is released when the transaction ends.
 */
const LOCK_KEYS = {
  rewardBudget: 7_001,
  bonusPool: 7_002,
} as const;

export async function lockPool(
  tx: Prisma.TransactionClient,
  pool: keyof typeof LOCK_KEYS,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEYS[pool]}::bigint)`;
}
