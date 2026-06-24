/**
 * App-wide constants. Rename the product by changing APP_NAME here (one line).
 * The DB-backed OrgSettings.appName can override this at runtime for display;
 * APP_NAME is the build-time default and fallback.
 */
export const APP_NAME = "Applaud";

export const APP_TAGLINE = "Recognise great work.";

/** Role identifiers used across auth, guards, and the schema. */
export const ROLES = ["staff", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Reward ledger entry types — every point movement is one of these. */
export const LEDGER_TYPES = [
  "RECOGNITION",
  "AWARD",
  "REDEMPTION",
  "EXPIRY",
  "ADJUSTMENT",
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

/** Reaction emojis offered in the feed UI. */
export const REACTION_EMOJIS = ["👏", "🎉", "❤️", "🙌", "💪", "⭐"] as const;
