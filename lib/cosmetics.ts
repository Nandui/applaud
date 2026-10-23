/**
 * The profile Store catalogue (Steam Points Shop style): avatar frames,
 * profile banners and accent themes people buy with their points.
 *
 * The live catalogue is the `Cosmetic` table, managed in Admin > Store, where
 * admins add their own items with uploaded pictures. The built-in items below
 * are what the table starts with (the migration and seed insert them). Their
 * ids are what people's `User.profile.owned` lists hold, so never rename one.
 *
 * Everything here is pure (no Prisma) so the server, the client and the unit
 * tests can share it. The server loads the table with `getCatalogue()` in
 * lib/catalogue.ts and hands the rows to these helpers.
 */

import { withFit } from "./frame-fit";
import { cssImageUrl } from "./image-url";

export type CosmeticKind = "frame" | "banner" | "theme";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export const COSMETIC_KINDS: CosmeticKind[] = ["frame", "banner", "theme"];
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  /**
   * Points. 0 means free, but it's still claimed in the shop like any other
   * item (only the default banner and theme are everyone's from the start).
   */
  price: number;
  rarity: Rarity;
  /**
   * Frame: a built-in `.frame-*` CSS class (globals.css). Banner: a CSS
   * background. Theme: a #rrggbb accent. Null when the item is a picture.
   */
  style: string | null;
  /** An uploaded picture: a frame overlay or a banner image. */
  imageUrl: string | null;
  /** Uploaded frames: how the picture sits on the avatar, "size,x,y" (lib/frame-fit.ts). */
  frameFit: string | null;
  /** Hidden items can't be bought, but people who own one keep wearing it. */
  active: boolean;
  /** The Store category it's grouped under (e.g. "Flags"), if any. */
  categoryId: string | null;
  /** When it went on sale, in ms since 1970: newer than someone's last shop visit is "New". */
  listedAt: number;
};

/**
 * A group of items of any kind, shown together in the profile shop with a
 * "Buy all" bundle priced at the plain sum of what the buyer doesn't own yet.
 */
export type StoreCategory = {
  id: string;
  name: string;
  /** Hidden categories don't show or sell as a bundle; their items show by kind. */
  active: boolean;
};

/** A built-in item as written below; the database fills in the rest. */
export type CosmeticSeed = Pick<Cosmetic, "id" | "kind" | "name" | "price" | "rarity"> & { style: string };

export const KIND_LABELS: Record<CosmeticKind, { one: string; many: string }> = {
  frame: { one: "Avatar frame", many: "Avatar frames" },
  banner: { one: "Banner", many: "Banners" },
  theme: { one: "Theme", many: "Themes" },
};

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#8b8b99" },
  rare: { label: "Rare", color: "#3b82f6" },
  epic: { label: "Epic", color: "#a855f7" },
  legendary: { label: "Legendary", color: "#f59e0b" },
};

export const BUILTIN_COSMETICS: CosmeticSeed[] = [
  // ---- Avatar frames ----
  { id: "frame-spark", kind: "frame", name: "Spark", price: 1, rarity: "common", style: "frame-spark" },
  { id: "frame-wave", kind: "frame", name: "Wave", price: 1, rarity: "common", style: "frame-wave" },
  { id: "frame-party", kind: "frame", name: "Confetti", price: 2, rarity: "rare", style: "frame-party" },
  { id: "frame-neon", kind: "frame", name: "Neon", price: 2, rarity: "rare", style: "frame-neon" },
  { id: "frame-gold", kind: "frame", name: "Gold", price: 4, rarity: "epic", style: "frame-gold" },
  { id: "frame-aurora", kind: "frame", name: "Aurora", price: 5, rarity: "epic", style: "frame-aurora" },
  { id: "frame-prism", kind: "frame", name: "Prism", price: 10, rarity: "legendary", style: "frame-prism" },

  // ---- Banners ----
  {
    id: "banner-violet",
    kind: "banner",
    name: "Violet",
    price: 0,
    rarity: "common",
    style: "linear-gradient(135deg, #7c5cff, #d14dff)",
  },
  {
    id: "banner-sunset",
    kind: "banner",
    name: "Sunset",
    price: 1,
    rarity: "common",
    style: "linear-gradient(135deg, #ff9f43, #ff4f9a)",
  },
  {
    id: "banner-ocean",
    kind: "banner",
    name: "Ocean",
    price: 1,
    rarity: "common",
    style: "linear-gradient(135deg, #22d3ee, #3b5bff)",
  },
  {
    id: "banner-mint",
    kind: "banner",
    name: "Mint",
    price: 1,
    rarity: "common",
    style: "linear-gradient(135deg, #34d399, #0ea5e9)",
  },
  {
    id: "banner-candy",
    kind: "banner",
    name: "Candy",
    price: 2,
    rarity: "rare",
    style:
      "radial-gradient(60% 120% at 15% 20%, #ffb3d9, transparent 60%), radial-gradient(60% 120% at 85% 80%, #b39bff, transparent 60%), linear-gradient(135deg, #ff7eb6, #8f6bff)",
  },
  {
    id: "banner-midnight",
    kind: "banner",
    name: "Midnight",
    price: 2,
    rarity: "rare",
    style:
      "radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 85% 65%, #fff, transparent), radial-gradient(1px 1px at 40% 75%, #fff, transparent), linear-gradient(160deg, #0f172a, #312e81 60%, #6d28d9)",
  },
  {
    id: "banner-lava",
    kind: "banner",
    name: "Lava",
    price: 3,
    rarity: "epic",
    style:
      "radial-gradient(70% 140% at 20% 100%, #fbbf24, transparent 55%), radial-gradient(60% 120% at 90% 0%, #dc2626, transparent 60%), linear-gradient(135deg, #f97316, #7c2d12)",
  },
  {
    id: "banner-aurora",
    kind: "banner",
    name: "Northern lights",
    price: 4,
    rarity: "epic",
    style:
      "radial-gradient(80% 100% at 30% 0%, #34d399, transparent 60%), radial-gradient(70% 100% at 80% 20%, #a78bfa, transparent 60%), linear-gradient(180deg, #0b1d2e, #10243f)",
  },
  {
    id: "banner-holo",
    kind: "banner",
    name: "Holographic",
    price: 8,
    rarity: "legendary",
    style:
      "conic-gradient(from 200deg at 60% 40%, #ff9ad5, #a5b4fc, #67e8f9, #bbf7d0, #fde68a, #ff9ad5)",
  },

  // ---- Accent themes (buttons, tabs and links on your profile) ----
  { id: "theme-violet", kind: "theme", name: "Violet", price: 0, rarity: "common", style: "#6a4dff" },
  { id: "theme-blue", kind: "theme", name: "Blue", price: 1, rarity: "common", style: "#2563eb" },
  { id: "theme-pink", kind: "theme", name: "Pink", price: 1, rarity: "common", style: "#e8458b" },
  { id: "theme-orange", kind: "theme", name: "Orange", price: 1, rarity: "common", style: "#ea6a12" },
  { id: "theme-green", kind: "theme", name: "Green", price: 1, rarity: "common", style: "#16a34a" },
  { id: "theme-red", kind: "theme", name: "Red", price: 1, rarity: "common", style: "#e11d48" },
  { id: "theme-teal", kind: "theme", name: "Teal", price: 1, rarity: "common", style: "#0d9488" },
  { id: "theme-gold", kind: "theme", name: "Gold", price: 2, rarity: "rare", style: "#c58b00" },
];

/** Highest points price an admin can set on a Store item. */
export const MAX_ITEM_PRICE = 100_000;

export const DEFAULT_BANNER = "banner-violet";
export const DEFAULT_THEME = "theme-violet";
const FALLBACK_BANNER = BUILTIN_COSMETICS.find((c) => c.id === DEFAULT_BANNER)!.style;
const FALLBACK_THEME = BUILTIN_COSMETICS.find((c) => c.id === DEFAULT_THEME)!.style;

/** The built-in items as full catalogue rows (used when the table is empty). */
export function builtinCatalogue(): Cosmetic[] {
  return BUILTIN_COSMETICS.map((c) => ({ ...c, imageUrl: null, frameFit: null, active: true, categoryId: null, listedAt: 0 }));
}

export function isKind(value: unknown): value is CosmeticKind {
  return typeof value === "string" && (COSMETIC_KINDS as string[]).includes(value);
}

export function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && (RARITIES as string[]).includes(value);
}

export function itemById(catalogue: Cosmetic[], id: string | null | undefined): Cosmetic | null {
  if (!id) return null;
  return catalogue.find((c) => c.id === id) ?? null;
}

/**
 * How an avatar frame is drawn: a built-in CSS class such as "frame-neon", or
 * the https URL of an uploaded overlay picture. FramedAvatar tells them apart.
 */
export type FrameArt = string;

export function isFrameImage(art: FrameArt): boolean {
  return art.startsWith("https://") || art.startsWith("http://");
}

/** A frame item's art (an uploaded picture carries its fit), or null if it has none. */
export function frameArt(item: Pick<Cosmetic, "style" | "imageUrl" | "frameFit">): FrameArt | null {
  return item.imageUrl ? withFit(item.imageUrl, item.frameFit) : (item.style ?? null);
}

/** A banner item as a CSS background (its picture, cover-cropped, or its gradient). */
export function bannerCss(item: Pick<Cosmetic, "style" | "imageUrl">): string {
  // Banners span the content column (at most ~600px wide), never wider.
  if (item.imageUrl) return `center / cover no-repeat url("${cssImageUrl(item.imageUrl, 600)}")`;
  return item.style ?? FALLBACK_BANNER;
}

/** Someone's resolved look, ready to draw: what the feed, profiles and lists receive. */
export type Look = { frame: FrameArt | null; banner: string; theme: string };

export const DEFAULT_LOOK: Look = { frame: null, banner: FALLBACK_BANNER, theme: FALLBACK_THEME };

/** The look of the default banner and theme in this catalogue. */
export function defaultLook(catalogue: Cosmetic[]): Look {
  const banner = itemById(catalogue, DEFAULT_BANNER);
  const theme = itemById(catalogue, DEFAULT_THEME);
  return {
    frame: null,
    banner: banner?.kind === "banner" ? bannerCss(banner) : FALLBACK_BANNER,
    theme: theme?.kind === "theme" && theme.style ? theme.style : FALLBACK_THEME,
  };
}
