-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pointsRank" TEXT NOT NULL DEFAULT 'staff';

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "monthlyAllowanceCentreManager" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "monthlyAllowanceOperations" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "monthlyAllowanceCeo" INTEGER NOT NULL DEFAULT 1200;

-- Everyone keeps exactly what they could give before: managers and admins
-- were on the manager allowance, Operations and CEO too. The three new
-- allowances start at the current manager allowance until an admin changes
-- them in Admin > Economy. Nobody is a Centre manager until an admin says so.
UPDATE "User" SET "pointsRank" = CASE "role"
  WHEN 'staff' THEN 'staff'
  WHEN 'operations' THEN 'operations'
  WHEN 'ceo' THEN 'ceo'
  ELSE 'manager'
END;
UPDATE "OrgSettings" SET
  "monthlyAllowanceCentreManager" = "monthlyAllowanceManager",
  "monthlyAllowanceOperations" = "monthlyAllowanceManager",
  "monthlyAllowanceCeo" = "monthlyAllowanceManager";
