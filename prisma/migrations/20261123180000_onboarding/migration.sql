-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- People who already use the app don't get the first-sign-in tour (or the
-- welcome points): anyone who has signed in with Google (an Account row) or
-- has done anything in the app. People who are on the roster but have never
-- signed in stay null, so they get the tour on their first sign-in.
UPDATE "User" u SET "onboardedAt" = NOW()
WHERE EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Recognition" r WHERE r."senderId" = u."id" AND NOT r."system")
   OR EXISTS (SELECT 1 FROM "Reaction" x WHERE x."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Comment" c WHERE c."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Redemption" d WHERE d."userId" = u."id")
   OR u."profile" IS NOT NULL;
