-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_siteId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managerGroup" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
