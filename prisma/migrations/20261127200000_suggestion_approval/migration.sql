-- Ideas become available: link to the reward / profile item and announce once.
ALTER TABLE "Suggestion" ADD COLUMN IF NOT EXISTS "rewardId" TEXT, ADD COLUMN IF NOT EXISTS "cosmeticId" TEXT, ADD COLUMN IF NOT EXISTS "announcedAt" TIMESTAMP(3);
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "emailSuggestions" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "chatSuggestions" BOOLEAN NOT NULL DEFAULT true;
