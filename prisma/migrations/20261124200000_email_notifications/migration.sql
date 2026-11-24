-- Recognition emails (to recipients, and a "someone was recognised" email to
-- everyone else) with a test mode that sends everything to one address.
-- Additive only: new defaulted columns.
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "emailRecipients" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailEveryone" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailTestMode" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailTestAddress" TEXT NOT NULL DEFAULT 'fernandoserina@leisureworldcork.com';
