-- AlterTable
ALTER TABLE "AwardProgram" ADD COLUMN     "nextVoteAt" TIMESTAMP(3),
ADD COLUMN     "voteDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "voteEvery" TEXT,
ADD COLUMN     "voteRole" TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN     "voteSetById" TEXT;

-- CreateTable
CREATE TABLE "AwardVoteRound" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "postId" TEXT,
    "results" JSONB,
    "winnerIds" TEXT[],
    "pointsEach" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AwardVoteRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardBallot" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AwardVoteRound_postId_key" ON "AwardVoteRound"("postId");

-- CreateIndex
CREATE INDEX "AwardVoteRound_status_closesAt_idx" ON "AwardVoteRound"("status", "closesAt");

-- CreateIndex
CREATE INDEX "AwardVoteRound_programId_status_idx" ON "AwardVoteRound"("programId", "status");

-- CreateIndex
CREATE INDEX "AwardBallot_roundId_nomineeId_idx" ON "AwardBallot"("roundId", "nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "AwardBallot_roundId_voterId_key" ON "AwardBallot"("roundId", "voterId");

-- AddForeignKey
ALTER TABLE "AwardVoteRound" ADD CONSTRAINT "AwardVoteRound_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AwardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardVoteRound" ADD CONSTRAINT "AwardVoteRound_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Recognition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardBallot" ADD CONSTRAINT "AwardBallot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "AwardVoteRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardBallot" ADD CONSTRAINT "AwardBallot_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardBallot" ADD CONSTRAINT "AwardBallot_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

