-- Standing staff discounts as a kind of reward, and shop labels ("Featured",
-- "This month only", "Discounted", "Last chance"…) with optional end dates.
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'reward';
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "discountText" TEXT;
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "promoTag" TEXT;
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "promoText" TEXT;
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "promoEndsAt" TIMESTAMP(3);
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "wasPointsCost" INTEGER;
