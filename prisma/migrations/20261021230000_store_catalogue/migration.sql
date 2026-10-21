-- Profile Store catalogue moves from code to the database so admins can add
-- their own frames, banners and themes (with uploaded pictures) in Admin > Store.

-- CreateTable
CREATE TABLE "Cosmetic" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "style" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cosmetic_kind_sortOrder_idx" ON "Cosmetic"("kind", "sortOrder");

-- The built-in items, with the same ids people already own them under.
INSERT INTO "Cosmetic" ("id", "kind", "name", "price", "rarity", "style", "sortOrder") VALUES
  ('frame-spark', 'frame', 'Spark', 1, 'common', 'frame-spark', 10),
  ('frame-wave', 'frame', 'Wave', 1, 'common', 'frame-wave', 20),
  ('frame-party', 'frame', 'Confetti', 2, 'rare', 'frame-party', 30),
  ('frame-neon', 'frame', 'Neon', 2, 'rare', 'frame-neon', 40),
  ('frame-gold', 'frame', 'Gold', 4, 'epic', 'frame-gold', 50),
  ('frame-aurora', 'frame', 'Aurora', 5, 'epic', 'frame-aurora', 60),
  ('frame-prism', 'frame', 'Prism', 10, 'legendary', 'frame-prism', 70),
  ('banner-violet', 'banner', 'Violet', 0, 'common', 'linear-gradient(135deg, #7c5cff, #d14dff)', 10),
  ('banner-sunset', 'banner', 'Sunset', 1, 'common', 'linear-gradient(135deg, #ff9f43, #ff4f9a)', 20),
  ('banner-ocean', 'banner', 'Ocean', 1, 'common', 'linear-gradient(135deg, #22d3ee, #3b5bff)', 30),
  ('banner-mint', 'banner', 'Mint', 1, 'common', 'linear-gradient(135deg, #34d399, #0ea5e9)', 40),
  ('banner-candy', 'banner', 'Candy', 2, 'rare', 'radial-gradient(60% 120% at 15% 20%, #ffb3d9, transparent 60%), radial-gradient(60% 120% at 85% 80%, #b39bff, transparent 60%), linear-gradient(135deg, #ff7eb6, #8f6bff)', 50),
  ('banner-midnight', 'banner', 'Midnight', 2, 'rare', 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 85% 65%, #fff, transparent), radial-gradient(1px 1px at 40% 75%, #fff, transparent), linear-gradient(160deg, #0f172a, #312e81 60%, #6d28d9)', 60),
  ('banner-lava', 'banner', 'Lava', 3, 'epic', 'radial-gradient(70% 140% at 20% 100%, #fbbf24, transparent 55%), radial-gradient(60% 120% at 90% 0%, #dc2626, transparent 60%), linear-gradient(135deg, #f97316, #7c2d12)', 70),
  ('banner-aurora', 'banner', 'Northern lights', 4, 'epic', 'radial-gradient(80% 100% at 30% 0%, #34d399, transparent 60%), radial-gradient(70% 100% at 80% 20%, #a78bfa, transparent 60%), linear-gradient(180deg, #0b1d2e, #10243f)', 80),
  ('banner-holo', 'banner', 'Holographic', 8, 'legendary', 'conic-gradient(from 200deg at 60% 40%, #ff9ad5, #a5b4fc, #67e8f9, #bbf7d0, #fde68a, #ff9ad5)', 90),
  ('theme-violet', 'theme', 'Violet', 0, 'common', '#6a4dff', 10),
  ('theme-blue', 'theme', 'Blue', 1, 'common', '#2563eb', 20),
  ('theme-pink', 'theme', 'Pink', 1, 'common', '#e8458b', 30),
  ('theme-orange', 'theme', 'Orange', 1, 'common', '#ea6a12', 40),
  ('theme-green', 'theme', 'Green', 1, 'common', '#16a34a', 50),
  ('theme-red', 'theme', 'Red', 1, 'common', '#e11d48', 60),
  ('theme-teal', 'theme', 'Teal', 1, 'common', '#0d9488', 70),
  ('theme-gold', 'theme', 'Gold', 2, 'rare', '#c58b00', 80)
ON CONFLICT ("id") DO NOTHING;

-- Carry over any prices an admin set in Economy (OrgSettings.cosmeticPrices).
-- Free starters stay free, as they did before.
UPDATE "Cosmetic" c
SET "price" = (o."cosmeticPrices" ->> c."id")::INTEGER
FROM "OrgSettings" o
WHERE o."id" = 'singleton'
  AND c."price" > 0
  AND jsonb_typeof(o."cosmeticPrices" -> c."id") = 'number'
  AND (o."cosmeticPrices" ->> c."id") ~ '^[0-9]+$';
