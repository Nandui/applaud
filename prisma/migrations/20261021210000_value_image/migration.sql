-- Optional badge artwork for each value (nullable, so existing values are unchanged).
ALTER TABLE "Value" ADD COLUMN "imageUrl" TEXT;
