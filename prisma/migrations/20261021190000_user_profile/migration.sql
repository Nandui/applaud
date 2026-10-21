-- Profile customization (bio, status, theme, decoration, pins).
-- Additive and nullable: existing rows are untouched.
ALTER TABLE "User" ADD COLUMN "profile" JSONB;
