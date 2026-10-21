import { z } from "zod";
import {
  bannerCss,
  defaultLook,
  frameArt,
  itemById,
  type Cosmetic,
  type CosmeticKind,
  type Look,
} from "@/lib/cosmetics";

/**
 * Profile customization. Everything a person chooses lives in the nullable
 * `User.profile` JSON column: their bio and pronouns, the shop items they own,
 * what they have equipped, and up to three pinned shout-outs. This module is
 * the single place that validates it and fills in defaults. Pure functions
 * only (no Prisma) so it can be unit-tested and shared by server and client.
 *
 * Item ids are checked against the Store catalogue (lib/cosmetics.ts), which
 * lives in the database, so anything that needs to know whether an item is
 * real, owned or worn takes the catalogue as an argument.
 */

export const BIO_MAX = 150;
export const PRONOUNS_MAX = 24;
export const MAX_PINNED = 3;

export type ProfileCustom = {
  pronouns: string;
  bio: string;
  /** Shop item ids this person has bought. Free items are implied. */
  owned: string[];
  frame: string | null;
  banner: string | null;
  theme: string | null;
  pinned: string[];
};

export const EMPTY_PROFILE: ProfileCustom = {
  pronouns: "",
  bio: "",
  owned: [],
  frame: null,
  banner: null,
  theme: null,
  pinned: [],
};

const storedSchema = z
  .object({
    pronouns: z.string().max(PRONOUNS_MAX).catch(""),
    bio: z.string().max(BIO_MAX).catch(""),
    owned: z.array(z.string()).catch([]),
    frame: z.string().nullable().catch(null),
    banner: z.string().nullable().catch(null),
    theme: z.string().nullable().catch(null),
    pinned: z.array(z.string()).catch([]),
  })
  .partial();

export function ownsItem(custom: Pick<ProfileCustom, "owned">, item: Pick<Cosmetic, "id" | "price">): boolean {
  return item.price === 0 || custom.owned.includes(item.id);
}

/**
 * Read whatever is in the JSON column into a complete, safe object. Malformed
 * values fall back to defaults instead of throwing, so a bad row can never
 * break someone's profile page. Item ids are kept as stored; `wornItem` and
 * `resolveLook` decide against the catalogue whether they still count.
 */
export function parseProfile(raw: unknown): ProfileCustom {
  const parsed = storedSchema.safeParse(raw ?? {});
  const p = parsed.success ? parsed.data : {};
  return {
    pronouns: p.pronouns ?? "",
    bio: p.bio ?? "",
    owned: [...new Set(p.owned ?? [])],
    frame: p.frame ?? null,
    banner: p.banner ?? null,
    theme: p.theme ?? null,
    pinned: (p.pinned ?? []).slice(0, MAX_PINNED),
  };
}

/** The item someone wears in a slot: it must exist, be that kind, and be theirs. */
export function wornItem(custom: ProfileCustom, kind: CosmeticKind, catalogue: Cosmetic[]): Cosmetic | null {
  const item = itemById(catalogue, custom[kind]);
  if (!item || item.kind !== kind || !ownsItem(custom, item)) return null;
  return item;
}

/** Someone's look, ready to draw: their frame art, banner CSS and accent colour. */
export function resolveLook(custom: ProfileCustom, catalogue: Cosmetic[]): Look {
  const fallback = defaultLook(catalogue);
  const frame = wornItem(custom, "frame", catalogue);
  const banner = wornItem(custom, "banner", catalogue);
  const theme = wornItem(custom, "theme", catalogue);
  return {
    frame: frame ? frameArt(frame) : null,
    banner: banner ? bannerCss(banner) : fallback.banner,
    theme: theme?.style ?? fallback.theme,
  };
}

/** Shorthand: the look straight from the raw `User.profile` column. */
export function lookOf(profile: unknown, catalogue: Cosmetic[]): Look {
  return resolveLook(parseProfile(profile), catalogue);
}

/** What the edit-profile form submits. */
export const profileInputSchema = z.object({
  pronouns: z.string().trim().max(PRONOUNS_MAX).optional().default(""),
  bio: z.string().trim().max(BIO_MAX).optional().default(""),
});

/** Buying adds the item to what you own and wears it straight away. */
export function withPurchase(custom: ProfileCustom, item: Pick<Cosmetic, "id" | "kind">): ProfileCustom {
  const owned = custom.owned.includes(item.id) ? custom.owned : [...custom.owned, item.id];
  return { ...custom, owned, [item.kind]: item.id };
}

/** Add bought items to what someone owns without changing what they wear. */
export function withOwned(custom: ProfileCustom, items: Pick<Cosmetic, "id">[]): ProfileCustom {
  return { ...custom, owned: [...new Set([...custom.owned, ...items.map((i) => i.id)])] };
}

export type Bundle = {
  /** The items "Buy all" would buy: for sale in the category and not owned yet. */
  items: Cosmetic[];
  /** Their plain sum in points (bundles have no discount). */
  price: number;
};

/** What buying a whole category costs this person right now. */
export function bundleFor(
  custom: Pick<ProfileCustom, "owned">,
  catalogue: Cosmetic[],
  categoryId: string,
): Bundle {
  const items = catalogue.filter((c) => c.categoryId === categoryId && c.active && !ownsItem(custom, c));
  return { items, price: items.reduce((sum, c) => sum + c.price, 0) };
}

/** Wear an owned item, or take off whatever is in that slot (`item` null). */
export function withEquipped(custom: ProfileCustom, kind: CosmeticKind, item: Cosmetic | null): ProfileCustom {
  if (item === null) return { ...custom, [kind]: null };
  if (item.kind !== kind || !ownsItem(custom, item)) return custom;
  return { ...custom, [kind]: item.id };
}

/** Relative luminance check so text on an accent colour stays readable. */
export function isLight(hexColour: string): boolean {
  const h = hexColour.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45;
}
