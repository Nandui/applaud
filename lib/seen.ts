/**
 * "New" items in the Store. Each person has a last-seen time per Store half
 * (User.shopSeenAt, User.rewardsSeenAt), stamped when they open that page;
 * anything listed after it shows as "New" and puts a dot on the tab. Pure
 * functions only, shared by the server, the client and the unit tests.
 */

/** "claims": admin updates to their own claimed rewards (My rewards). */
export type SeenArea = "shop" | "rewards" | "claims";

/** How many unseen items (or claim updates) each Store tab has for someone. */
export type NewCounts = Record<SeenArea, number>;

export const NO_NEW: NewCounts = { shop: 0, rewards: 0, claims: 0 };

/** Listed after the person last looked (never looked: everything is new). */
export function isNewSince(listedAt: Date | number, seenAt: Date | null): boolean {
  if (!seenAt) return true;
  return new Date(listedAt).getTime() > seenAt.getTime();
}

/** The seen time to store for a visit rendered at `renderedAt` (ms): never in the future. */
export function seenAtFor(renderedAt: unknown, now = Date.now()): Date | null {
  if (typeof renderedAt !== "number" || !Number.isFinite(renderedAt) || renderedAt <= 0) return null;
  return new Date(Math.min(renderedAt, now));
}

/**
 * When a shop or rewards page's data was read (ms), taken before its queries
 * so nothing listed meanwhile is marked seen unshown. Server pages render once
 * per request, so reading the clock here is safe.
 */
export function visitStamp(): number {
  return Date.now();
}
