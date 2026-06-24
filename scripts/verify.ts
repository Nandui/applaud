// Verifies the wallet invariant (User.walletBalance == SUM(RewardLedger.amount))
// for every user, and prints a target user's balance + recent ledger rows.
// Usage: npx tsx scripts/verify.ts [email]
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function main() {
  const email = process.argv[2];
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, walletBalance: true },
  });
  const sums = await prisma.rewardLedger.groupBy({
    by: ["userId"],
    _sum: { amount: true },
  });
  const sumMap = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));

  let mismatches = 0;
  for (const u of users) {
    const s = sumMap.get(u.id) ?? 0;
    if (s !== u.walletBalance) {
      mismatches++;
      console.log(`MISMATCH ${u.name}: cache=${u.walletBalance} ledger=${s}`);
    }
  }
  console.log(
    `Invariant: ${users.length - mismatches}/${users.length} users OK, ${mismatches} mismatch(es)`,
  );

  if (email) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, walletBalance: true },
    });
    if (u) {
      const recent = await prisma.rewardLedger.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { amount: true, type: true, note: true },
      });
      console.log(
        `\n${u.name}: walletBalance=${u.walletBalance} ledgerSum=${sumMap.get(u.id) ?? 0}`,
      );
      console.log("recent:", JSON.stringify(recent));
    } else {
      console.log(`\nNo user with email ${email}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
