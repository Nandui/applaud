-- Thanks for covering at short notice (Recognition kind "cover") with its own
-- monthly allowance per rank. Additive only: new nullable or defaulted columns.
ALTER TABLE "Recognition" ADD COLUMN IF NOT EXISTS "coverType" TEXT, ADD COLUMN IF NOT EXISTS "coverWhat" TEXT;

ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "coverAllowanceManager" INTEGER NOT NULL DEFAULT 1000, ADD COLUMN IF NOT EXISTS "coverAllowanceCentreManager" INTEGER NOT NULL DEFAULT 1000, ADD COLUMN IF NOT EXISTS "coverAllowanceOperations" INTEGER NOT NULL DEFAULT 1000, ADD COLUMN IF NOT EXISTS "coverAllowanceCeo" INTEGER NOT NULL DEFAULT 1000, ADD COLUMN IF NOT EXISTS "coverPointsSuggested" INTEGER NOT NULL DEFAULT 200, ADD COLUMN IF NOT EXISTS "maxPointsPerCover" INTEGER NOT NULL DEFAULT 500;
