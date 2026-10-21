-- Points economy: 100 pts = €1, €500/month reward budget, monthly stock,
-- per shout-out caps and a monthly bonus pool.

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "euroCostCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "monthlyStock" INTEGER;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN "euroCostCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Redemption_createdAt_idx" ON "Redemption"("createdAt");

-- AlterTable
ALTER TABLE "OrgSettings" ALTER COLUMN "monthlyAllowanceStaff" SET DEFAULT 400,
ALTER COLUMN "monthlyAllowanceManager" SET DEFAULT 1200,
ADD COLUMN "pointsPerEuro" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "cosmeticPrices" JSONB,
ADD COLUMN "monthlyRewardBudgetCents" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN "maxPointsPerShoutoutStaff" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "maxPointsPerShoutoutManager" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN "monthlyBonusPool" INTEGER NOT NULL DEFAULT 4400;

-- Move the settings row to the new allowances only if nobody has changed the
-- old defaults (100 / 200) by hand.
UPDATE "OrgSettings"
SET "monthlyAllowanceStaff" = 400, "monthlyAllowanceManager" = 1200
WHERE "monthlyAllowanceStaff" = 100 AND "monthlyAllowanceManager" = 200;
