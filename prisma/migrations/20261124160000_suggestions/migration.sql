-- Staff ideas for future rewards and profile shop items, with upvotes.
-- Additive only: two new tables, nothing existing is changed.
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "statusChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuggestionVote" (
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionVote_pkey" PRIMARY KEY ("suggestionId","userId")
);

-- CreateIndex
CREATE INDEX "Suggestion_kind_status_idx" ON "Suggestion"("kind", "status");

-- CreateIndex
CREATE INDEX "SuggestionVote_userId_idx" ON "SuggestionVote"("userId");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
