-- Pause every automated milestone post except birthdays (reversible "for now").
--
-- The daily cron only posts for ACTIVE milestone rules, so deactivating the
-- work-anniversary and onboarding rules stops them while leaving them in
-- Admin → Milestones to be switched back on later. Birthday stays active.
-- We also delete the anniversary/onboarding feed cards already generated.
-- Birthday celebrations, the award-win post, and all points/ledger history are
-- left untouched.

-- 1) Remove the feed posts already created for those milestones. Deleting a
--    Recognition cascades to its recipients, reactions, and comments.
DELETE FROM "Recognition"
WHERE "id" IN (
  SELECT "recognitionId"
  FROM "Celebration"
  WHERE "type" IN ('work_anniversary', 'onboarding')
    AND "recognitionId" IS NOT NULL
);

-- 2) Drop the matching celebration records.
DELETE FROM "Celebration" WHERE "type" IN ('work_anniversary', 'onboarding');

-- 3) Deactivate the rules so the cron stops posting them (re-enable any time).
UPDATE "MilestoneRule" SET "active" = false
WHERE "type" IN ('work_anniversary', 'onboarding');
