// Independent hand-check of the all-time / all-sites participation rate.
import "dotenv/config";
import { startOfMonth, endOfMonth } from "date-fns";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function rateFor(
  prisma: PrismaClient,
  activeIds: Set<string>,
  where: object,
) {
  const senders = await prisma.recognition.findMany({
    where: { system: false, ...where },
    select: { senderId: true },
  });
  const recips = await prisma.recognitionRecipient.findMany({
    where: { recognition: { system: false, ...where } },
    select: { userId: true },
  });
  const participants = new Set<string>();
  for (const s of senders) if (activeIds.has(s.senderId)) participants.add(s.senderId);
  for (const r of recips) if (activeIds.has(r.userId)) participants.add(r.userId);
  return {
    participants: participants.size,
    rate: Math.round((participants.size / activeIds.size) * 100),
  };
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true },
  });
  const activeIds = new Set(activeUsers.map((u) => u.id));

  const all = await rateFor(prisma, activeIds, {});
  const now = new Date();
  const month = await rateFor(prisma, activeIds, {
    createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
  });
  console.log(`active=${activeIds.size}`);
  console.log(`ALL-TIME : participants=${all.participants} rate=${all.rate}%`);
  console.log(`THIS MONTH: participants=${month.participants} rate=${month.rate}%`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
