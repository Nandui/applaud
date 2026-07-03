-- One reaction per person per recognition.
--
-- Previously a user could add several different-emoji reactions to the same
-- post (unique on recognition+user+emoji). Collapse that to one reaction each.

-- 1) De-duplicate any existing multi-reactions, keeping the earliest per
--    (recognition, user). Two passes: by createdAt, then by id as a tie-break.
DELETE FROM "Reaction" a
USING "Reaction" b
WHERE a."recognitionId" = b."recognitionId"
  AND a."userId" = b."userId"
  AND a."createdAt" > b."createdAt";

DELETE FROM "Reaction" a
USING "Reaction" b
WHERE a."recognitionId" = b."recognitionId"
  AND a."userId" = b."userId"
  AND a."createdAt" = b."createdAt"
  AND a."id" > b."id";

-- 2) Swap the unique index from (recognition, user, emoji) to (recognition, user).
DROP INDEX "Reaction_recognitionId_userId_emoji_key";
CREATE UNIQUE INDEX "Reaction_recognitionId_userId_key"
  ON "Reaction"("recognitionId", "userId");
