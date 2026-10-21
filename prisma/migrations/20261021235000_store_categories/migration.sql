-- Store categories: admins group frames, banners and themes (e.g. "Flags",
-- "Pride") and staff can buy a whole category as a bundle. Existing items stay
-- uncategorised, so nothing about current items or purchases changes.

-- CreateTable
CREATE TABLE "CosmeticCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cosmetic" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Cosmetic_categoryId_idx" ON "Cosmetic"("categoryId");

-- AddForeignKey
ALTER TABLE "Cosmetic" ADD CONSTRAINT "Cosmetic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CosmeticCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
