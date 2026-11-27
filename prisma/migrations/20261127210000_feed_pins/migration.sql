-- Pin a recognition or post to the top of the Home feed until a set time.
ALTER TABLE "Recognition" ADD COLUMN IF NOT EXISTS "feedPinnedUntil" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "feedPinnedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "feedPinnedById" TEXT;
CREATE INDEX IF NOT EXISTS "Recognition_feedPinnedUntil_idx" ON "Recognition"("feedPinnedUntil");
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Recognition_feedPinnedById_fkey') THEN ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_feedPinnedById_fkey" FOREIGN KEY ("feedPinnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
