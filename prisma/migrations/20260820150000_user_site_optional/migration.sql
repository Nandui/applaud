-- Removed users are detached from their site, so User.siteId becomes optional.
ALTER TABLE "User" ALTER COLUMN "siteId" DROP NOT NULL;
