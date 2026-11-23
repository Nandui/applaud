-- Unspent wallet points expire at the end of each year (31 Dec, Irish time).
-- On by default; switch off in Admin > Economy. The first expiry is 31 Dec
-- 2026 (lib/wallet-expiry.ts never touches earlier years).
ALTER TABLE "OrgSettings" ADD COLUMN "walletPointsExpireYearEnd" BOOLEAN NOT NULL DEFAULT true;
