-- AlterTable
ALTER TABLE "User" ADD COLUMN     "claimsSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- Claims moved on before this change: date the change, but start everyone as
-- having seen them so nobody gets a dot for old news.
UPDATE "Redemption" SET "statusChangedAt" = COALESCE("fulfilledAt", "approvedAt") WHERE "status" <> 'requested';
UPDATE "User" SET "claimsSeenAt" = CURRENT_TIMESTAMP;
