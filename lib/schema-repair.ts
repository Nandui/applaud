import { prisma } from "@/lib/prisma";

/**
 * Safety net for the 2026-11-23 outage: production's build reported success
 * but the database the app reads at runtime never got the latest migrations
 * (Recognition.audienceSiteIds missing, every feed load failed with P2022).
 *
 * On server start this checks, against the SAME database the app queries
 * (DATABASE_URL), that the newest additive migrations are in place. Anything
 * missing is applied idempotently (IF NOT EXISTS) inside one transaction under
 * an advisory lock, and recorded in _prisma_migrations with Prisma's own
 * checksum so a later `prisma migrate deploy` treats it as already applied.
 *
 * Only purely additive migrations belong here. When the check finds nothing
 * missing it costs one small query per cold start.
 */

type Repair = {
  name: string;
  checksum: string;
  /** SQL returning one row with `ok` = true when the migration's objects exist. */
  check: string;
  statements: string[];
};

const REPAIRS: Repair[] = [
  {
    name: "20261123200000_wallet_year_end_expiry",
    checksum: "337474d22109561b1d16ef10eda01c88752dcd9c437052300fa32abfe7237aa4",
    check: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'OrgSettings' AND column_name = 'walletPointsExpireYearEnd') AS ok`,
    statements: [
      `ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "walletPointsExpireYearEnd" BOOLEAN NOT NULL DEFAULT true`,
    ],
  },
  {
    name: "20261123210000_award_badge",
    checksum: "b9c7a5f58301aa60e22c14d8907f046319b67bf48cbec459e38fd80612fd91f6",
    check: `SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'AwardProgram' AND column_name IN ('icon', 'color')) = 2 AS ok`,
    statements: [
      `ALTER TABLE "AwardProgram" ADD COLUMN IF NOT EXISTS "icon" TEXT, ADD COLUMN IF NOT EXISTS "color" TEXT`,
    ],
  },
  {
    name: "20261123220000_poll_question_posts",
    checksum: "ea5660de61f36ac7f9571aec5a92d360070cc128de9e28d276ffc3a3daaad1f0",
    check: `SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Recognition' AND column_name IN ('pollClosesAt', 'pollShowResults', 'audienceSiteIds')) = 3
      AND to_regclass('"PollOption"') IS NOT NULL
      AND to_regclass('"PollVote"') IS NOT NULL
      AND to_regclass('"QuestionAnswer"') IS NOT NULL AS ok`,
    statements: [
      `ALTER TABLE "Recognition" ADD COLUMN IF NOT EXISTS "pollClosesAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "pollShowResults" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "audienceSiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
      `CREATE TABLE IF NOT EXISTS "PollOption" ("id" TEXT NOT NULL, "recognitionId" TEXT NOT NULL, "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "PollVote" ("id" TEXT NOT NULL, "recognitionId" TEXT NOT NULL, "optionId" TEXT NOT NULL, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "QuestionAnswer" ("id" TEXT NOT NULL, "recognitionId" TEXT NOT NULL, "userId" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "PollOption_recognitionId_idx" ON "PollOption"("recognitionId")`,
      `CREATE INDEX IF NOT EXISTS "PollVote_optionId_idx" ON "PollVote"("optionId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_recognitionId_userId_key" ON "PollVote"("recognitionId", "userId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "QuestionAnswer_recognitionId_userId_key" ON "QuestionAnswer"("recognitionId", "userId")`,
      ...[
        ["PollOption", "PollOption_recognitionId_fkey", `FOREIGN KEY ("recognitionId") REFERENCES "Recognition"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
        ["PollVote", "PollVote_recognitionId_fkey", `FOREIGN KEY ("recognitionId") REFERENCES "Recognition"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
        ["PollVote", "PollVote_optionId_fkey", `FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
        ["PollVote", "PollVote_userId_fkey", `FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`],
        ["QuestionAnswer", "QuestionAnswer_recognitionId_fkey", `FOREIGN KEY ("recognitionId") REFERENCES "Recognition"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
        ["QuestionAnswer", "QuestionAnswer_userId_fkey", `FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`],
      ].map(
        ([table, name, def]) =>
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${def}; END IF; END $$`,
      ),
    ],
  },
  {
    name: "20261123230000_reward_featured_order",
    checksum: "2d9530339e8a7459851670c641a90c175a9910eac48353759dc9bed0878c1a5c",
    check: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Reward' AND column_name = 'featuredOrder') AS ok`,
    statements: [`ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "featuredOrder" INTEGER`],
  },
  {
    name: "20261124140000_user_other_sites",
    checksum: "c51e048203e762b9e862bace392d3085ee59e0e421e830058af23c9c5c777930",
    check: `SELECT to_regclass('"UserSite"') IS NOT NULL AS ok`,
    statements: [
      `CREATE TABLE IF NOT EXISTS "UserSite" ("userId" TEXT NOT NULL, "siteId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserSite_pkey" PRIMARY KEY ("userId","siteId"))`,
      `CREATE INDEX IF NOT EXISTS "UserSite_siteId_idx" ON "UserSite"("siteId")`,
      ...[
        ["UserSite_userId_fkey", `FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
        ["UserSite_siteId_fkey", `FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
      ].map(
        ([name, def]) =>
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN ALTER TABLE "UserSite" ADD CONSTRAINT "${name}" ${def}; END IF; END $$`,
      ),
    ],
  },
];

async function isOk(sql: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(sql);
  return rows[0]?.ok === true;
}

export async function repairSchema(): Promise<void> {
  const missing: Repair[] = [];
  for (const r of REPAIRS) if (!(await isOk(r.check))) missing.push(r);
  if (missing.length === 0) return;

  console.warn(
    `[schema-repair] Missing in the runtime database: ${missing.map((m) => m.name).join(", ")}. Applying.`,
  );
  await prisma.$transaction(
    async (tx) => {
      // One instance at a time; others wait, then find everything in place.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(724113)`);
      const hasLedger = await tx.$queryRawUnsafe<{ ok: boolean }[]>(
        `SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS ok`,
      );
      for (const r of missing) {
        for (const s of r.statements) await tx.$executeRawUnsafe(s);
        if (hasLedger[0]?.ok) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
             SELECT gen_random_uuid()::text, $1::text, now(), $2::text, NULL, now(), 1
             WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $2::text AND finished_at IS NOT NULL AND rolled_back_at IS NULL)`,
            r.checksum,
            r.name,
          );
        }
      }
    },
    { timeout: 30_000, maxWait: 15_000 },
  );
  console.warn("[schema-repair] Done.");
}
