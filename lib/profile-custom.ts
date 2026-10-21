import { z } from "zod";
import { cosmeticById, isFree, type CosmeticKind } from "@/lib/cosmetics";

/**
 * Profile customization. Everything a person chooses lives in the nullable
 * `User.profile` JSON column: their bio and pronouns, the shop items they own,
 * what they have equipped, and up to three pinned shout-outs. This module is
 * the single place that validates it and fills in defaults. Pure functions
 * only (no Prisma) so it can be unit-tested and shared by server and client.
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

export function ownsItem(custom: Pick<ProfileCustom, "owned">, id: string): boolean {
  return isFree(id) || custom.owned.includes(id);
}

/** An equipped slot only counts when it's the right kind and actually owned. */
function equipped(id: string | null | undefined, kind: CosmeticKind, owned: string[]): string | null {
  const item = cosmeticById(id);
  if (!item || item.kind !== kind) return null;
  return isFree(item.id) || owned.includes(item.id) ? item.id : null;
}

/**
 * Read whatever is in the JSON column into a complete, safe object. Unknown or
 * malformed values fall back to defaults instead of throwing, so a bad row can
 * never break someone's profile page.
 */
export function parseProfile(raw: unknown): ProfileCustom {
  const parsed = storedSchema.safeParse(raw ?? {});
  const p = parsed.success ? parsed.data : {};
  const owned = [...new Set(p.owned ?? [])].filter((id) => cosmeticById(id));
  return {
    pronouns: p.pronouns ?? "",
    bio: p.bio ?? "",
    owned,
    frame: equipped(p.frame, "frame", owned),
    banner: equipped(p.banner, "banner", owned),
    theme: equipped(p.theme, "theme", owned),
    pinned: (p.pinned ?? []).slice(0, MAX_PINNED),
  };
}

/** What the edit-profile form submits. */
export const profileInputSchema = z.object({
  pronouns: z.string().trim().max(PRONOUNS_MAX).optional().default(""),
  bio: z.string().trim().max(BIO_MAX).optional().default(""),
});

/** Buying adds the item to what you own and wears it straight away. */
export function withPurchase(custom: ProfileCustom, id: string): ProfileCustom {
  const item = cosmeticById(id);
  if (!item) return custom;
  const owned = custom.owned.includes(id) ? custom.owned : [...custom.owned, id];
  return { ...custom, owned, [item.kind]: id };
}

/** Wear an owned item, or take off whatever is in that slot (`id` null). */
export function withEquipped(custom: ProfileCustom, kind: CosmeticKind, id: string | null): ProfileCustom {
  if (id === null) return { ...custom, [kind]: null };
  const item = cosmeticById(id);
  if (!item || item.kind !== kind || !ownsItem(custom, id)) return custom;
  return { ...custom, [kind]: id };
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
