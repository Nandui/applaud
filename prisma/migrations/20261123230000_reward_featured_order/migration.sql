-- Admin-set position of a labelled reward in the Featured row (null = not placed yet).
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "featuredOrder" INTEGER;
