-- Admin > Settings > Emails: a master switch that pauses every email Yayup sends,
-- plus one switch per kind of email.
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "emailsEnabled" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailRecognitions" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailTeamAnnouncements" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "emailInvites" BOOLEAN NOT NULL DEFAULT true;
