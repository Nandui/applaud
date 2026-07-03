-- Remove automated birthday celebrations — the last active milestone award.
--
-- Mirrors the earlier non-birthday pause (20260625120000): the daily cron only
-- posts for ACTIVE milestone rules, so deactivating the birthday rule stops it
-- while leaving it in Admin → Milestones to switch back on later. We also delete
-- the birthday feed cards and celebration records already generated. Points and
-- ledger history are left untouched (reversing awarded points would shrink real
-- wallet balances — do that deliberately, not as a side effect of this change).

-- 1) Remove the feed posts already created for birthdays. Deleting a
--    Recognition cascades to its recipients, reactions, and comments.
DELETE FROM "Recognition"
WHERE "id" IN (
  SELECT "recognitionId"
  FROM "Celebration"
  WHERE "type" = 'birthday'
    AND "recognitionId" IS NOT NULL
);

-- 2) Drop the matching celebration records.
DELETE FROM "Celebration" WHERE "type" = 'birthday';

-- 3) Deactivate the rule so the cron stops posting birthdays (re-enable any time).
UPDATE "MilestoneRule" SET "active" = false WHERE "type" = 'birthday';
