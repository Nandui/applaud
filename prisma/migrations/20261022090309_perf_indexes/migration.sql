-- Speed: index the foreign keys and filters the feed, profiles, wallet,
-- leaderboard and monthly allowance queries look up by. IF [NOT] EXISTS keeps
-- it safe to re-run. RewardLedger(userId) is replaced by (userId, createdAt),
-- which serves the same lookups and also the wallet history order.

-- DropIndex
DROP INDEX IF EXISTS "RewardLedger_userId_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_recognitionId_createdAt_idx" ON "Comment"("recognitionId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Nomination_nomineeId_status_idx" ON "Nomination"("nomineeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Nomination_nominatorId_idx" ON "Nomination"("nominatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Nomination_status_createdAt_idx" ON "Nomination"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recognition_senderId_createdAt_idx" ON "Recognition"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecognitionRecipient_userId_idx" ON "RecognitionRecipient"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Redemption_userId_idx" ON "Redemption"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Redemption_rewardId_idx" ON "Redemption"("rewardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RewardLedger_userId_createdAt_idx" ON "RewardLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RewardLedger_type_createdAt_idx" ON "RewardLedger"("type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_siteId_idx" ON "User"("siteId");
