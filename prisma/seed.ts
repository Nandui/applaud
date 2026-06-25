/**
 * Applaud seed — realistic dev data per build-spec §11.
 *
 * Run with: npm run db:seed  (tsx prisma/seed.ts)
 *
 * Idempotent-ish: wipes all tables first, then recreates. Safe to re-run.
 * Wallet invariant: every point grant/spend writes a RewardLedger row;
 * User.walletBalance is recomputed from the ledger sum at the end.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { subDays, addDays } from "date-fns";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ---------- deterministic RNG so re-seeds are stable ----------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}

const now = new Date();
function monthDayInYear(year: number, ref: Date) {
  return new Date(Date.UTC(year, ref.getUTCMonth(), ref.getUTCDate()));
}

async function wipe() {
  // Delete in FK-dependency order.
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.recognitionRecipient.deleteMany();
  await prisma.celebration.deleteMany();
  await prisma.recognition.deleteMany();
  await prisma.nomination.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.rewardLedger.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.awardProgram.deleteMany();
  await prisma.milestoneRule.deleteMany();
  await prisma.value.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();
  await prisma.orgSettings.deleteMany();
}

async function main() {
  console.log("Wiping existing data…");
  await wipe();

  // ---------- Sites ----------
  console.log("Creating sites…");
  const siteSeed = [
    { code: "MAH", name: "Mahon Point Leisure" },
    { code: "BAL", name: "Ballincollig Sports Hub" },
    { code: "CFC", name: "City Fitness Centre" },
    { code: "SPC", name: "Southside Pool & Spa" },
  ];
  const sites = await Promise.all(
    siteSeed.map((s) =>
      prisma.site.create({
        data: { code: s.code, name: s.name, timezone: "Europe/Dublin" },
      }),
    ),
  );
  const siteByCode = Object.fromEntries(sites.map((s) => [s.code, s]));

  // ---------- Org settings ----------
  console.log("Creating org settings…");
  await prisma.orgSettings.create({
    data: {
      id: "singleton",
      appName: "Applaud",
      monthlyAllowanceStaff: 100,
      monthlyAllowanceManager: 200,
      pointsExpiryMonths: null,
      allowSelfRecognition: false,
    },
  });

  // ---------- Values ----------
  console.log("Creating values…");
  const valueSeed = [
    { name: "Member First", description: "Puts members and guests at the heart of every decision.", icon: "HeartHandshake", color: "#0e7c86" },
    { name: "Team Player", description: "Backs up colleagues and makes the whole team better.", icon: "Users", color: "#4f46e5" },
    { name: "Safety First", description: "Keeps everyone safe and never cuts corners.", icon: "ShieldCheck", color: "#15803d" },
    { name: "Goes Above & Beyond", description: "Brings extra effort when it matters most.", icon: "Rocket", color: "#be123c" },
    { name: "Reliable", description: "Dependable, consistent, and always shows up.", icon: "BadgeCheck", color: "#0ea5e9" },
    { name: "Positive Energy", description: "Lifts the mood and brings the good vibes.", icon: "Sun", color: "#d97706" },
  ];
  const values = await Promise.all(
    valueSeed.map((v, i) => prisma.value.create({ data: { ...v, order: i } })),
  );

  // ---------- Milestone rules ----------
  console.log("Creating milestone rules…");
  await prisma.milestoneRule.createMany({
    data: [
      // Birthday is the only automated celebration enabled for now. The others
      // are seeded inactive — switch them on in Admin → Milestones to resume.
      { type: "birthday", config: {}, points: 100 },
      { type: "work_anniversary", config: { years: [1, 3, 5, 10] }, points: 250, active: false },
      { type: "onboarding", config: { dayOffset: 30 }, points: 50, active: false },
    ],
  });

  // ---------- Award programs ----------
  console.log("Creating award programs…");
  const eotm = await prisma.awardProgram.create({
    data: {
      name: "Employee of the Month",
      description: "Recognising standout contribution each month, voted by nomination.",
      points: 500,
      cadence: "monthly",
      requiresApproval: true,
    },
  });
  await prisma.awardProgram.create({
    data: {
      name: "Spot Award",
      description: "An ad-hoc shout-out for going the extra mile, any time.",
      points: 150,
      cadence: null,
      requiresApproval: false,
    },
  });

  // ---------- Rewards ----------
  console.log("Creating rewards…");
  await prisma.reward.createMany({
    data: [
      { name: "Guest Day Pass", description: "A free day pass for a friend or family member.", category: "Passes", pointsCost: 150, stock: null },
      { name: "PT / Induction Session", description: "A one-to-one session with a personal trainer.", category: "Wellbeing", pointsCost: 300, stock: null },
      { name: "Café Voucher (€5)", description: "€5 to spend at the on-site café.", category: "Food & Drink", pointsCost: 120, stock: null },
      { name: "Retail Voucher (€10)", description: "€10 voucher for the pro shop.", category: "Food & Drink", pointsCost: 220, stock: 25 },
      { name: "Branded Hoodie", description: "A cosy branded hoodie in your size.", category: "Merch", pointsCost: 500, stock: 10 },
      { name: "Branded Water Bottle", description: "Stay hydrated in style.", category: "Merch", pointsCost: 180, stock: null },
      { name: "Extra Half-Day Off", description: "Knock off early — an extra half-day of leave.", category: "Time Off", pointsCost: 800, stock: null },
      { name: "Priority Shift Pick", description: "First pick of shifts for the next rota.", category: "Perks", pointsCost: 250, stock: null },
    ],
  });

  // ---------- Users ----------
  console.log("Creating users…");
  type UserSeed = {
    name: string;
    role: "staff" | "manager" | "admin";
    site: string;
    jobTitle: string;
    managerName?: string;
    hireDate: Date;
    birthday: Date;
  };

  const yearsAgo = (n: number, ref: Date = now) => new Date(Date.UTC(ref.getUTCFullYear() - n, randInt(0, 11), randInt(1, 28)));
  const bday = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

  // Special milestone dates (relative to "today") so the cron has live targets.
  const anniversaryToday = monthDayInYear(now.getUTCFullYear() - 5, now); // 5-yr anniversary today
  const onboardingToday = subDays(now, 30); // onboarding +30 fires today
  const birthdayToday = monthDayInYear(1991, now); // birthday today
  const within7 = addDays(now, 4); // a birthday a few days out

  const userSeed: UserSeed[] = [
    // Admins (ops, HQ at MAH)
    { name: "Orla Kennedy", role: "admin", site: "MAH", jobTitle: "Operations Admin", hireDate: yearsAgo(7), birthday: bday(1986, 2, 14) },
    { name: "Cian Doyle", role: "admin", site: "MAH", jobTitle: "People & Rewards Admin", hireDate: yearsAgo(4), birthday: bday(1990, 9, 3) },

    // Managers (one per site)
    { name: "Niamh Walsh", role: "manager", site: "MAH", jobTitle: "Duty Manager", hireDate: anniversaryToday, birthday: bday(1988, 5, 21) },
    { name: "Darragh Murphy", role: "manager", site: "BAL", jobTitle: "Centre Manager", hireDate: yearsAgo(6), birthday: bday(1984, 11, 2) },
    { name: "Aoife Byrne", role: "manager", site: "CFC", jobTitle: "Fitness Manager", hireDate: yearsAgo(3), birthday: birthdayToday },
    { name: "Seán O'Brien", role: "manager", site: "SPC", jobTitle: "Aquatics Manager", hireDate: yearsAgo(5), birthday: bday(1987, 7, 19) },

    // MAH staff
    { name: "Saoirse Lynch", role: "staff", site: "MAH", jobTitle: "Lifeguard", managerName: "Niamh Walsh", hireDate: onboardingToday, birthday: bday(2000, 3, 8) },
    { name: "Conor Kelly", role: "staff", site: "MAH", jobTitle: "Fitness Instructor", managerName: "Niamh Walsh", hireDate: yearsAgo(2), birthday: bday(1996, 12, 30) },
    { name: "Emer Fitzgerald", role: "staff", site: "MAH", jobTitle: "Receptionist", managerName: "Niamh Walsh", hireDate: yearsAgo(1), birthday: bday(1998, 6, 1) },
    { name: "Liam Nolan", role: "staff", site: "MAH", jobTitle: "Café Assistant", managerName: "Niamh Walsh", hireDate: yearsAgo(3), birthday: bday(1995, 8, 23) },

    // BAL staff
    { name: "Róisín Daly", role: "staff", site: "BAL", jobTitle: "Swim Teacher", managerName: "Darragh Murphy", hireDate: yearsAgo(2), birthday: bday(1999, 1, 17) },
    { name: "Eoin Brennan", role: "staff", site: "BAL", jobTitle: "Personal Trainer", managerName: "Darragh Murphy", hireDate: yearsAgo(4), birthday: bday(1993, 4, 9) },
    { name: "Méabh Quinn", role: "staff", site: "BAL", jobTitle: "Lifeguard", managerName: "Darragh Murphy", hireDate: monthDayInYear(now.getUTCFullYear() - 1, within7), birthday: monthDayInYear(1997, within7) },
    { name: "Patrick Gallagher", role: "staff", site: "BAL", jobTitle: "Receptionist", managerName: "Darragh Murphy", hireDate: yearsAgo(1), birthday: bday(1994, 10, 11) },

    // CFC staff
    { name: "Ciara Healy", role: "staff", site: "CFC", jobTitle: "Fitness Instructor", managerName: "Aoife Byrne", hireDate: yearsAgo(3), birthday: bday(1992, 2, 27) },
    { name: "Fionn Power", role: "staff", site: "CFC", jobTitle: "Personal Trainer", managerName: "Aoife Byrne", hireDate: yearsAgo(2), birthday: bday(1996, 5, 5) },
    { name: "Aisling Moore", role: "staff", site: "CFC", jobTitle: "Class Instructor", managerName: "Aoife Byrne", hireDate: yearsAgo(1), birthday: bday(2001, 9, 14) },
    { name: "Oisín Reid", role: "staff", site: "CFC", jobTitle: "Maintenance", managerName: "Aoife Byrne", hireDate: yearsAgo(6), birthday: bday(1989, 7, 2) },

    // SPC staff
    { name: "Niamh Collins", role: "staff", site: "SPC", jobTitle: "Lifeguard", managerName: "Seán O'Brien", hireDate: yearsAgo(2), birthday: bday(1998, 3, 22) },
    { name: "Cathal Burke", role: "staff", site: "SPC", jobTitle: "Swim Teacher", managerName: "Seán O'Brien", hireDate: yearsAgo(4), birthday: bday(1991, 11, 30) },
    { name: "Sorcha Whelan", role: "staff", site: "SPC", jobTitle: "Spa Therapist", managerName: "Seán O'Brien", hireDate: yearsAgo(3), birthday: bday(1995, 1, 6) },
    { name: "Diarmuid Kavanagh", role: "staff", site: "SPC", jobTitle: "Receptionist", managerName: "Seán O'Brien", hireDate: yearsAgo(1), birthday: bday(2000, 8, 19) },
    { name: "Gráinne Sheehan", role: "staff", site: "SPC", jobTitle: "Café Assistant", managerName: "Seán O'Brien", hireDate: yearsAgo(2), birthday: bday(1997, 4, 28) },
    { name: "Tadhg Ryan", role: "staff", site: "SPC", jobTitle: "Personal Trainer", managerName: "Seán O'Brien", hireDate: yearsAgo(5), birthday: bday(1990, 12, 12) },
  ];

  const emailFor = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/\s+/g, ".") + "@applaud.test";

  // Pass 1: create users without manager links.
  const userByName = new Map<string, { id: string }>();
  for (const u of userSeed) {
    const created = await prisma.user.create({
      data: {
        email: emailFor(u.name),
        name: u.name,
        role: u.role,
        jobTitle: u.jobTitle,
        siteId: siteByCode[u.site].id,
        hireDate: u.hireDate,
        birthday: u.birthday,
      },
    });
    userByName.set(u.name, created);
  }

  // Pass 2: wire managers.
  for (const u of userSeed) {
    if (!u.managerName) continue;
    const self = userByName.get(u.name)!;
    const mgr = userByName.get(u.managerName)!;
    await prisma.user.update({ where: { id: self.id }, data: { managerId: mgr.id } });
  }

  const allUsers = [...userByName.entries()].map(([name, u]) => ({ name, id: u.id }));
  const staffAndManagers = allUsers; // everyone can give/receive

  // Running balance map for ledger-aware redemptions.
  const balances = new Map<string, number>();
  const credit = (userId: string, amount: number) =>
    balances.set(userId, (balances.get(userId) ?? 0) + amount);

  // ---------- Historical recognitions ----------
  console.log("Creating recognitions…");
  const messages = [
    "Stepped in to cover a busy poolside shift at the last minute — total lifesaver.",
    "Calmed a nervous first-time swimmer and made their session brilliant.",
    "Spotted a hazard on the gym floor and sorted it before anyone was at risk.",
    "Stayed late to help close down and reset for the morning rush.",
    "Went out of their way to help a member find the right class.",
    "Brilliant energy in spin class today — the room was buzzing.",
    "Handled a tricky complaint with patience and a smile.",
    "Trained the new starter so well they were confident on day one.",
    "Kept the café running single-handed during the lunch rush.",
    "Noticed a member struggling and quietly offered a hand.",
    "Always the first to volunteer for the jobs nobody else wants.",
    "Made the whole team laugh on a tough Monday — exactly what we needed.",
  ];

  const recognitionPointsPool = [10, 15, 20, 20, 25, 30, 40, 50];
  const recognitions: { id: string; senderId: string }[] = [];

  for (let i = 0; i < 34; i++) {
    const sender = pick(staffAndManagers);
    const candidates = staffAndManagers.filter((u) => u.id !== sender.id);
    const recipients = sample(candidates, randInt(1, 2));
    const value = pick(values);
    const createdAt = subDays(now, randInt(0, 60));
    const hasPoints = rng() < 0.6;
    const points = hasPoints ? pick(recognitionPointsPool) : 0;

    const rec = await prisma.recognition.create({
      data: {
        senderId: sender.id,
        valueId: value.id,
        message: pick(messages),
        visibility: rng() < 0.92 ? "public" : "private",
        createdAt,
        recipients: {
          create: recipients.map((r) => ({ userId: r.id, points })),
        },
      },
    });
    recognitions.push({ id: rec.id, senderId: sender.id });

    if (points > 0) {
      for (const r of recipients) {
        await prisma.rewardLedger.create({
          data: {
            userId: r.id,
            amount: points,
            type: "RECOGNITION",
            sourceType: "recognition_recipient",
            sourceId: rec.id,
            note: `Recognition from ${sender.name}`,
            createdAt,
          },
        });
        credit(r.id, points);
      }
    }

    // Reactions
    const reactors = sample(candidates, randInt(0, 4));
    const emojis = ["👏", "🎉", "❤️", "🙌", "💪", "⭐"];
    for (const reactor of reactors) {
      await prisma.reaction.create({
        data: { recognitionId: rec.id, userId: reactor.id, emoji: pick(emojis), createdAt },
      }).catch(() => {});
    }

    // Comments
    if (rng() < 0.3) {
      const commenter = pick(candidates);
      await prisma.comment.create({
        data: {
          recognitionId: rec.id,
          userId: commenter.id,
          body: pick(["Well deserved! 👏", "Couldn't agree more.", "Great work as always.", "Legend."]),
          createdAt,
        },
      });
    }
  }

  // ---------- Nominations ----------
  console.log("Creating nominations…");
  const admin = userByName.get("Orla Kennedy")!;
  const nomineeApproved = userByName.get("Saoirse Lynch")!;
  const nominator = userByName.get("Conor Kelly")!;

  // One approved nomination -> AWARD ledger + system feed post.
  const approvedAt = subDays(now, 5);
  await prisma.nomination.create({
    data: {
      programId: eotm.id,
      nominatorId: nominator.id,
      nomineeId: nomineeApproved.id,
      justification: "Saoirse has been outstanding on poolside — calm in a crisis and endlessly patient with members.",
      status: "approved",
      reviewedById: admin.id,
      reviewedAt: approvedAt,
      pointsAwarded: eotm.points,
      createdAt: subDays(now, 8),
    },
  });
  const awardPost = await prisma.recognition.create({
    data: {
      senderId: admin.id,
      message: `🏆 ${userByName.has("Saoirse Lynch") ? "Saoirse Lynch" : "A colleague"} won ${eotm.name}!`,
      system: true,
      createdAt: approvedAt,
      recipients: { create: [{ userId: nomineeApproved.id, points: 0 }] },
    },
  });
  await prisma.rewardLedger.create({
    data: {
      userId: nomineeApproved.id,
      amount: eotm.points,
      type: "AWARD",
      sourceType: "nomination",
      sourceId: awardPost.id,
      note: `Won ${eotm.name}`,
      createdAt: approvedAt,
    },
  });
  credit(nomineeApproved.id, eotm.points);

  // Two pending nominations for the admin queue.
  await prisma.nomination.create({
    data: {
      programId: eotm.id,
      nominatorId: userByName.get("Aoife Byrne")!.id,
      nomineeId: userByName.get("Ciara Healy")!.id,
      justification: "Ciara's classes are consistently the best attended — members love her.",
      status: "pending",
      createdAt: subDays(now, 2),
    },
  });
  await prisma.nomination.create({
    data: {
      programId: eotm.id,
      nominatorId: userByName.get("Darragh Murphy")!.id,
      nomineeId: userByName.get("Eoin Brennan")!.id,
      justification: "Eoin rebuilt our PT onboarding from scratch and retention is up.",
      status: "pending",
      createdAt: subDays(now, 1),
    },
  });

  // ---------- Redemptions (a couple, ledger-aware) ----------
  console.log("Creating redemptions…");
  const rewards = await prisma.reward.findMany();
  const cafe = rewards.find((r) => r.name.startsWith("Café"))!;
  const bottle = rewards.find((r) => r.name.startsWith("Branded Water"))!;

  const affordable = (cost: number) => allUsers.filter((u) => (balances.get(u.id) ?? 0) >= cost);

  const cafeBuyer = pick(affordable(cafe.pointsCost));
  if (cafeBuyer) {
    await prisma.redemption.create({
      data: { userId: cafeBuyer.id, rewardId: cafe.id, pointsCost: cafe.pointsCost, status: "requested", createdAt: subDays(now, 3) },
    });
    await prisma.rewardLedger.create({
      data: { userId: cafeBuyer.id, amount: -cafe.pointsCost, type: "REDEMPTION", sourceType: "redemption", note: `Redeemed ${cafe.name}`, createdAt: subDays(now, 3) },
    });
    credit(cafeBuyer.id, -cafe.pointsCost);
  }
  const bottleBuyer = pick(affordable(bottle.pointsCost).filter((u) => u.id !== cafeBuyer?.id));
  if (bottleBuyer) {
    await prisma.redemption.create({
      data: { userId: bottleBuyer.id, rewardId: bottle.id, pointsCost: bottle.pointsCost, status: "fulfilled", fulfilledById: admin.id, fulfilledAt: subDays(now, 1), createdAt: subDays(now, 4) },
    });
    await prisma.rewardLedger.create({
      data: { userId: bottleBuyer.id, amount: -bottle.pointsCost, type: "REDEMPTION", sourceType: "redemption", note: `Redeemed ${bottle.name}`, createdAt: subDays(now, 4) },
    });
    credit(bottleBuyer.id, -bottle.pointsCost);
  }

  // ---------- Recompute cached wallet balances from the ledger ----------
  console.log("Recomputing wallet balances…");
  const sums = await prisma.rewardLedger.groupBy({ by: ["userId"], _sum: { amount: true } });
  const sumById = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));
  for (const u of allUsers) {
    await prisma.user.update({ where: { id: u.id }, data: { walletBalance: sumById.get(u.id) ?? 0 } });
  }

  // ---------- Summary ----------
  const counts = {
    sites: await prisma.site.count(),
    users: await prisma.user.count(),
    values: await prisma.value.count(),
    recognitions: await prisma.recognition.count(),
    ledgerRows: await prisma.rewardLedger.count(),
    nominations: await prisma.nomination.count(),
    rewards: await prisma.reward.count(),
    redemptions: await prisma.redemption.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
