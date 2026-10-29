-- Ordinary feed posts share the Recognition table (and so its reactions and
-- comments). Existing rows are all shout-outs.
ALTER TABLE "Recognition" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'recognition';
