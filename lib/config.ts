/**
 * App-wide constants. Rename the product by changing APP_NAME here (one line).
 * The DB-backed OrgSettings.appName can override this at runtime for display;
 * APP_NAME is the build-time default and fallback.
 */
export const APP_NAME = "Applaud";

export const APP_TAGLINE = "Recognise great work.";

/**
 * Role identifiers used across auth, guards, and the schema.
 * `operations` and `ceo` are specialist roles: they don't grant admin/manager
 * access, but they can apply the point-multiplier boosts (see BOOSTS below).
 */
export const ROLES = ["staff", "manager", "admin", "operations", "ceo"] as const;
export type Role = (typeof ROLES)[number];

/** Reward ledger entry types — every point movement is one of these. */
export const LEDGER_TYPES = [
  "RECOGNITION",
  "AWARD",
  "REDEMPTION",
  "EXPIRY",
  "ADJUSTMENT",
  "BOOST",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

/** Redemption lifecycle. */
export const REDEMPTION_STATUSES = [
  "requested",
  "approved",
  "fulfilled",
  "cancelled",
] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

/** Nomination lifecycle. */
export const NOMINATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type NominationStatus = (typeof NOMINATION_STATUSES)[number];

/** The curated set of reactions offered in the feed's reaction picker. */
export const REACTION_EMOJIS = ["👏", "❤️", "🎉", "🙌", "🔥", "😂"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * Privileged point-multiplier "boosts". Applying one multiplies the points on a
 * recognition; they're mutually exclusive and the higher multiplier wins. Only
 * a user whose role matches `role` may apply that boost.
 */
export const BOOSTS = {
  operations: { role: "operations", label: "Operations", multiplier: 2, emoji: "⚙️" },
  ceo: { role: "ceo", label: "CEO", multiplier: 5, emoji: "👑" },
} as const satisfies Record<
  string,
  { role: Role; label: string; multiplier: number; emoji: string }
>;

export type BoostType = keyof typeof BOOSTS;
export const BOOST_TYPES = Object.keys(BOOSTS) as BoostType[];

/** True if a user with `role` is allowed to apply the given boost. */
export function canApplyBoost(role: string, type: BoostType): boolean {
  return role === BOOSTS[type].role;
}

/** The boost a given role may apply, if any (each role maps to one). */
export function boostForRole(role: string): BoostType | null {
  return BOOST_TYPES.find((t) => BOOSTS[t].role === role) ?? null;
}

export function boostMultiplier(type: BoostType): number {
  return BOOSTS[type].multiplier;
}

/**
 * Recognition image attachments (photos / GIFs). Shared by the client uploader,
 * the upload token route, and the server action so the limits stay in lockstep.
 */
export const MAX_RECOGNITION_IMAGES = 4;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per file

/** How many GIFs the GIPHY search route returns per query. */
export const GIF_SEARCH_LIMIT = 24;
