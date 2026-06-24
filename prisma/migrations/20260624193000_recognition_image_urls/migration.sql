-- AlterTable: optional photos/GIFs attached to a recognition (Vercel Blob URLs).
-- Existing rows default to an empty array so the NOT NULL constraint is safe.
ALTER TABLE "Recognition" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
