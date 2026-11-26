-- When the "haven't joined yet" nudge last emailed each person (Admin > Users).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastNudgedAt" TIMESTAMP(3);
