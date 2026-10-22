-- Free Store items are now claimed in the shop like any other item, and new
-- Store items and rewards show as "New" until each person has looked.

-- When each person last opened the profile shop and the rewards list.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rewardsSeenAt" TIMESTAMP(3);

-- When each item went on show. Existing items count from when they were added.
ALTER TABLE "Cosmetic" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Cosmetic" SET "listedAt" = "createdAt";
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Reward" SET "listedAt" = "createdAt";

-- Free items used to be everyone's without claiming. Anyone already wearing one
-- keeps it: it goes into their owned list, as if they had claimed it.
UPDATE "User" u
SET "profile" = jsonb_set(
  u."profile",
  '{owned}',
  COALESCE(u."profile"->'owned', '[]'::jsonb) || (
    SELECT COALESCE(jsonb_agg(c."id"), '[]'::jsonb)
    FROM "Cosmetic" c
    WHERE c."price" = 0
      AND c."id" IN (u."profile"->>'frame', u."profile"->>'banner', u."profile"->>'theme')
      AND NOT (COALESCE(u."profile"->'owned', '[]'::jsonb) ? c."id")
  )
)
WHERE jsonb_typeof(u."profile") = 'object'
  AND COALESCE(jsonb_typeof(u."profile"->'owned'), 'array') = 'array'
  AND EXISTS (
    SELECT 1 FROM "Cosmetic" c
    WHERE c."price" = 0
      AND c."id" IN (u."profile"->>'frame', u."profile"->>'banner', u."profile"->>'theme')
      AND NOT (COALESCE(u."profile"->'owned', '[]'::jsonb) ? c."id")
  );
