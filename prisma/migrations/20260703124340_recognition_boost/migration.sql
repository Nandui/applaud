-- AlterTable
ALTER TABLE "Recognition" ADD COLUMN     "boostAt" TIMESTAMP(3),
ADD COLUMN     "boostById" TEXT,
ADD COLUMN     "boostType" TEXT,
ALTER COLUMN "imageUrls" DROP DEFAULT;
