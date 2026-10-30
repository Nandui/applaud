-- CreateTable
CREATE TABLE "CommentTyping" (
    "recognitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentTyping_pkey" PRIMARY KEY ("recognitionId","userId")
);

-- CreateIndex
CREATE INDEX "CommentTyping_recognitionId_updatedAt_idx" ON "CommentTyping"("recognitionId", "updatedAt");
