-- Auto-create accounts on first company Google sign-in (on by default), and
-- flag those accounts until an admin has checked their role and site.
ALTER TABLE "OrgSettings" ADD COLUMN "autoCreateGoogleUsers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
