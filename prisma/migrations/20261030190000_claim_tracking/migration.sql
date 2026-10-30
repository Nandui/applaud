-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "fulfilmentAmount" INTEGER,
ADD COLUMN     "fulfilmentUnit" TEXT;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "expectedBy" TIMESTAMP(3),
ADD COLUMN     "fulfilmentLabel" TEXT,
ADD COLUMN     "staffNote" TEXT;
