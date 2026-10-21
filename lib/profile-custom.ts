import { z } from "zod";

/**
 * Profile customization: the free, earn-don't-buy take on Discord/Steam
 * profiles. Everything a person chooses lives in the nullable `User.profile`
 * JSON column; this module is the single place that validates it, fills in
 * defaults, and decides which avatar decorations someone has unlocked.
 * Pure functions only (no Prisma) so it can be unit-tested and shared by
 * server actions and client editors alike.
 */

// ---------- Limits ----------

export const BIO_MAX = 190;
export const STATUS_MAX = 60;
export const PRONOUNS_MAX = 24;
export const MAX_PINNED = 3;

const HEX = /^#[0-9a-fA-F]{6}$/;

// ---------- Themes (banner + page tint) ----------

export type ThemePreset = {
  id: string;
  label: string;
  primary: string;
  accent: string;
};

/** Named two-colour palettes, Handshake/Discord style. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "ultraviolet", label: "Ultraviolet", primary: "#7c5cff", accent: "#ff4f9a" },
  { id: "lime", label: "Lime", primary: "#c6f432", accent: "#22c55e" },
  { id: "poolside", label: "Poolside", primary: "#22d3ee", accent: "#3b82f6" },
  { id: "sunset", label: "Sunset", primary: "#ff9f43", accent: "#ff4f6d" },
  { id: "bubblegum", label: "Bubblegum", primary: "#f9a8d4", accent: "#c084fc" },
  { id: "forest", label: "Forest", primary: "#10b981", accent: "#065f46" },
  { id: "midnight", label: "Midnight", primary: "#312e81", accent: "#0f172a" },
  { id: "ember", label: "Ember", primary: "#ef4444", accent: "#7c2d12" },
];

export const DEFAULT_THEME = THEME_PRESETS[0];

// ---------- Avatar decorations (earned, never bought) ----------

export type UnlockStats = {
  received: number;
  given: number;
  awardsWon: number;
  milestones: number;
  level: number;
};

export type Decoration = {
  id: string;
  label: string;
  /** How you unlock it, shown on locked tiles. */
  hint: string;
  unlocked: (s: UnlockStats) => boolean;
};

export const DECORATIONS: Decoration[] = [
  {
    id: "spark",
    label: "Spark",
    hint: "Get your first shout-out",
    unlocked: (s) => s.received >= 1,
  },
  {
    id: "wave",
    label: "Wave",
    hint: "Send 5 shout-outs",
    unlocked: (s) => s.given >= 5,
  },
  {
    id: "neon",
    label: "Neon",
    hint: "Get 10 shout-outs",
    unlocked: (s) => s.received >= 10,
  },
  {
    id: "party",
    label: "Party",
    hint: "Celebrate a milestone",
    unlocked: (s) => s.milestones >= 1,
  },
  {
    id: "gold",
    label: "Gold",
    hint: "Win an award",
    unlocked: (s) => s.awardsWon >= 1,
  },
  {
    id: "aurora",
    label: "Aurora",
    hint: "Get 25 shout-outs",
    unlocked: (s) => s.received >= 25,
  },
  {
    id: "crown",
    label: "Crown",
    hint: "Reach level 10",
    unlocked: (s) => s.level >= 10,
  },
];

export function decorationById(id: string | null | undefined): Decoration | null {
  return DECORATIONS.find((d) => d.id === id) ?? null;
}

export function unlockedDecorations(stats: UnlockStats): Set<string> {
  return new Set(DECORATIONS.filter((d) => d.unlocked(stats)).map((d) => d.id));
}

// ---------- Level (Steam-style, derived from activity) ----------

/** XP: points earned, plus a little for every shout-out sent and received. */
export function xpFor(stats: {
  pointsEarned: number;
  given: number;
  received: number;
}): number {
  return Math.max(0, stats.pointsEarned) + stats.given * 15 + stats.received * 10;
}

/** Total XP needed to reach `level` (level 1 starts at 0; each step costs 50 more). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return 25 * n * (n + 1);
}

export function levelFor(xp: number): {
  level: number;
  xp: number;
  intoLevel: number;
  levelSpan: number;
  progress: number;
} {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const into = xp - floor;
  return { level, xp, intoLevel: into, levelSpan: span, progress: into / span };
}

// ---------- Stored shape ----------

const hex = z.string().regex(HEX, "Use a #rrggbb colour.");

/** What the editor submits (and what's stored). */
export const profileInputSchema = z.object({
  pronouns: z.string().trim().max(PRONOUNS_MAX).optional().default(""),
  bio: z.string().trim().max(BIO_MAX).optional().default(""),
  statusEmoji: z.string().trim().max(16).optional().default(""),
  statusText: z.string().trim().max(STATUS_MAX).optional().default(""),
  themePrimary: hex.optional(),
  themeAccent: hex.optional(),
  decoration: z.string().trim().max(32).optional().default(""),
  pinned: z.array(z.string().min(1).max(64)).max(MAX_PINNED).optional().default([]),
});

export type ProfileInput = z.input<typeof profileInputSchema>;

export type ProfileCustom = {
  pronouns: string;
  bio: string;
  status: { emoji: string; text: string } | null;
  theme: { primary: string; accent: string };
  /** True when the person picked a theme (vs. the default). */
  themed: boolean;
  decoration: string | null;
  pinned: string[];
};

const storedSchema = z
  .object({
    pronouns: z.string().max(PRONOUNS_MAX).catch(""),
    bio: z.string().max(BIO_MAX).catch(""),
    status: z
      .object({ emoji: z.string().max(16).catch(""), text: z.string().max(STATUS_MAX).catch("") })
      .nullable()
      .catch(null),
    theme: z.object({ primary: hex, accent: hex }).nullable().catch(null),
    decoration: z.string().max(32).nullable().catch(null),
    pinned: z.array(z.string()).catch([]),
  })
  .partial();

/**
 * Read whatever is in the JSON column into a complete, safe object. Unknown or
 * malformed values fall back to defaults instead of throwing, so a bad row can
 * never break someone's profile page.
 */
export function parseProfile(raw: unknown): ProfileCustom {
  const parsed = storedSchema.safeParse(raw ?? {});
  const p = parsed.success ? parsed.data : {};
  const status =
    p.status && (p.status.emoji || p.status.text)
      ? { emoji: p.status.emoji ?? "", text: p.status.text ?? "" }
      : null;
  return {
    pronouns: p.pronouns ?? "",
    bio: p.bio ?? "",
    status,
    theme: p.theme ?? { primary: DEFAULT_THEME.primary, accent: DEFAULT_THEME.accent },
    themed: Boolean(p.theme),
    decoration: p.decoration && decorationById(p.decoration) ? p.decoration : null,
    pinned: (p.pinned ?? []).slice(0, MAX_PINNED),
  };
}

/**
 * Turn validated editor input into the stored JSON. Locked decorations and
 * pins that aren't allowed are dropped here, so the server action stays a thin
 * wrapper: pass in what this person has unlocked and may pin.
 */
export function toStoredProfile(
  input: z.output<typeof profileInputSchema>,
  allowed: { decorations: Set<string>; pinnable: Set<string> },
) {
  const theme =
    input.themePrimary && input.themeAccent
      ? { primary: input.themePrimary.toLowerCase(), accent: input.themeAccent.toLowerCase() }
      : null;
  const decoration =
    input.decoration && allowed.decorations.has(input.decoration) ? input.decoration : null;
  const pinned = [...new Set(input.pinned)].filter((id) => allowed.pinnable.has(id)).slice(0, MAX_PINNED);
  const status =
    input.statusEmoji || input.statusText
      ? { emoji: input.statusEmoji, text: input.statusText }
      : null;
  return {
    pronouns: input.pronouns,
    bio: input.bio,
    status,
    theme,
    decoration,
    pinned,
  };
}

// ---------- Colour helpers ----------

/** Relative luminance check so text on a banner stays readable. */
export function isLight(hexColour: string): boolean {
  const h = hexColour.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45;
}
