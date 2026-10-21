/**
 * The profile shop catalogue (Steam Points Shop style): avatar frames, profile
 * banners and accent themes people buy with their applaud points. Defined in
 * code rather than the database so the styles live next to the CSS that draws
 * them (frames are the `.frame-*` classes in globals.css). Pure data, safe to
 * import on the client.
 */

export type CosmeticKind = "frame" | "banner" | "theme";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  price: number;
  rarity: Rarity;
  /** Banner: a CSS background. Theme: a #rrggbb accent. Frame: unused (CSS class). */
  style?: string;
};

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

export const COSMETICS: Cosmetic[] = [
  // ---- Avatar frames ----
  { id: "frame-spark", kind: "frame", name: "Spark", price: 1, rarity: "common" },
  { id: "frame-wave", kind: "frame", name: "Wave", price: 1, rarity: "common" },
  { id: "frame-party", kind: "frame", name: "Confetti", price: 2, rarity: "rare" },
  { id: "frame-neon", kind: "frame", name: "Neon", price: 2, rarity: "rare" },
  { id: "frame-gold", kind: "frame", name: "Gold", price: 4, rarity: "epic" },
  { id: "frame-aurora", kind: "frame", name: "Aurora", price: 5, rarity: "epic" },
  { id: "frame-prism", kind: "frame", name: "Prism", price: 10, rarity: "legendary" },

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

export const DEFAULT_BANNER = "banner-violet";
export const DEFAULT_THEME = "theme-violet";

export function cosmeticById(id: string | null | undefined): Cosmetic | null {
  return COSMETICS.find((c) => c.id === id) ?? null;
}

/** Admin price overrides, { "<cosmetic id>": points }, from OrgSettings.cosmeticPrices. */
export type CosmeticPrices = Record<string, number>;

/** Read the stored overrides, dropping anything malformed or unknown. */
export function parseCosmeticPrices(raw: unknown): CosmeticPrices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CosmeticPrices = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (cosmeticById(id) && typeof value === "number" && Number.isInteger(value) && value >= 0) {
      out[id] = value;
    }
  }
  return out;
}

/**
 * The price staff actually pay: the admin override when set, else the
 * catalogue price. Starter items (catalogue price 0) are always free, since
 * everyone owns them from day one.
 */
export function effectivePrice(item: Cosmetic, prices: CosmeticPrices): number {
  if (item.price === 0) return 0;
  return prices[item.id] ?? item.price;
}

/** The catalogue with admin prices applied. */
export function pricedCosmetics(prices: CosmeticPrices): Cosmetic[] {
  return COSMETICS.map((c) => ({ ...c, price: effectivePrice(c, prices) }));
}

/** Free items everyone owns from day one. */
export function isFree(id: string): boolean {
  return (cosmeticById(id)?.price ?? 1) === 0;
}

/** The CSS class that draws a frame, e.g. "frame-neon". */
export function frameClass(id: string | null | undefined): string | null {
  const item = cosmeticById(id);
  return item?.kind === "frame" ? item.id : null;
}

export function bannerStyle(id: string | null | undefined): string {
  const item = cosmeticById(id);
  return (item?.kind === "banner" ? item.style : undefined) ?? cosmeticById(DEFAULT_BANNER)!.style!;
}

export function themeColour(id: string | null | undefined): string {
  const item = cosmeticById(id);
  return (item?.kind === "theme" ? item.style : undefined) ?? cosmeticById(DEFAULT_THEME)!.style!;
}
