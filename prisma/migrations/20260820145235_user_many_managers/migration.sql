-- A person's manager becomes a set of people. The join table is created and
-- backfilled from the old single User.managerId before that column (and the
-- manager-group flag it shared the field with) is dropped, so nobody loses the
-- manager they already had.

-- CreateTable
CREATE TABLE "UserManager" (
    "userId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserManager_pkey" PRIMARY KEY ("userId","managerId")
);

-- CreateIndex
CREATE INDEX "UserManager_managerId_idx" ON "UserManager"("managerId");

-- AddForeignKey
ALTER TABLE "UserManager" ADD CONSTRAINT "UserManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserManager" ADD CONSTRAINT "UserManager_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing named manager becomes one row in the join.
INSERT INTO "UserManager" ("userId", "managerId")
SELECT "id", "managerId" FROM "User" WHERE "managerId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_managerId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "managerGroup",
DROP COLUMN "managerId";
