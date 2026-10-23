/**
 * Reward kinds and shop labels (Admin > Rewards). Pure functions only, shared
 * by the server, the client and the unit tests.
 *
 * - A "discount" is a standing staff discount: always on, no points, no stock,
 *   never claimed. It sits in its own section at the top of the Rewards shop.
 * - Any reward can carry one promo label ("Featured", "Last chance"…), with an
 *   optional end date. Labelled rewards also show in the Featured row.
 * - "Discounted" shows the usual price struck through; the sale price is the
 *   one charged. When it ends, the usual price comes back by itself.
 * - "This month only" and "Last chance" mean the reward goes: when they end,
 *   the reward leaves the shop. Other labels just come off.
 */
import { ECONOMY_TIMEZONE, zonedDayStart } from "@/lib/economy";

export const REWARD_KINDS = ["reward", "discount"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const PROMO_TAGS = ["featured", "month_only", "discounted", "last_chance", "limited"] as const;
export type PromoTag = (typeof PROMO_TAGS)[number];

export const PROMO_LABELS: Record<PromoTag, string> = {
  featured: "Featured",
  month_only: "This month only",
  discounted: "Discounted",
  last_chance: "Last chance",
  limited: "Limited time",
};

/** Labels whose end date takes the reward out of the shop, not just the label. */
export const LEAVES_WHEN_ENDED: readonly PromoTag[] = ["month_only", "last_chance"];

/** The order the Featured row shows labels in. */
const PROMO_RANK: Record<PromoTag, number> = {
  last_chance: 0,
  month_only: 1,
  discounted: 2,
  limited: 3,
  featured: 4,
};

export function isPromoTag(v: unknown): v is PromoTag {
  return typeof v === "string" && (PROMO_TAGS as readonly string[]).includes(v);
}

export type PromoFields = {
  kind: string;
  pointsCost: number;
  wasPointsCost: number | null;
  promoTag: string | null;
  promoText: string | null;
  promoEndsAt: Date | null;
};

export type PromoState = {
  /** The label showing now, or null. */
  tag: PromoTag | null;
  /** What the badge says: the admin's own wording, else the preset. */
  label: string | null;
  /** The price charged right now. */
  pointsCost: number;
  /** The usual price, shown struck through while "Discounted" runs. */
  wasPointsCost: number | null;
  /** When the label ends, while it's running. */
  endsAt: Date | null;
  /** The label ended and took the reward with it. */
  gone: boolean;
};

/** What a reward looks like in the shop at `now`. */
export function promoState(r: PromoFields, now: Date = new Date()): PromoState {
  const tag = isPromoTag(r.promoTag) ? r.promoTag : null;
  const ended = tag !== null && r.promoEndsAt !== null && r.promoEndsAt.getTime() <= now.getTime();
  // A sale only counts when it really is cheaper than usual.
  const onSale = tag === "discounted" && r.wasPointsCost !== null && r.wasPointsCost > r.pointsCost;
  if (!tag || ended) {
    return {
      tag: null,
      label: null,
      pointsCost: ended && onSale ? r.wasPointsCost! : r.pointsCost,
      wasPointsCost: null,
      endsAt: null,
      gone: ended && LEAVES_WHEN_ENDED.includes(tag!),
    };
  }
  return {
    tag,
    label: r.promoText?.trim() || PROMO_LABELS[tag],
    pointsCost: r.pointsCost,
    wasPointsCost: onSale ? r.wasPointsCost : null,
    endsAt: r.promoEndsAt,
    gone: false,
  };
}

/** Sort key for the Featured row: most urgent first, then soonest to end. */
export function promoRank(p: Pick<PromoState, "tag" | "endsAt">): [number, number] {
  return [p.tag ? PROMO_RANK[p.tag] : 99, p.endsAt ? p.endsAt.getTime() : Number.MAX_SAFE_INTEGER];
}

/**
 * Prisma filter for rewards still in the shop at `now`: drops rewards whose
 * "This month only" or "Last chance" has ended. Written as an OR of positives
 * because SQL NOT on a NULL label would drop unlabelled rewards too.
 */
export function notGoneWhere(now: Date = new Date()) {
  return {
    OR: [
      { promoTag: null },
      { promoTag: { notIn: [...LEAVES_WHEN_ENDED] } },
      { promoEndsAt: null },
      { promoEndsAt: { gt: now } },
    ],
  };
}

/** "2026-10-31" (the last day it runs, Irish time) → the instant it ends. */
export function parseEndDate(raw: string, tz: string = ECONOMY_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const check = new Date(Date.UTC(y, mo, d));
  if (check.getUTCMonth() !== mo || check.getUTCDate() !== d) return null;
  return zonedDayStart(y, mo, d + 1, tz);
}

/** The instant an end date ends → "2026-10-31" for a date input. */
export function endDateInput(endsAt: Date | null, tz: string = ECONOMY_TIMEZONE): string {
  if (!endsAt) return "";
  // The last day it runs is the local day just before the end instant.
  const lastMoment = new Date(endsAt.getTime() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(lastMoment);
}

/** The last day of the month `now` is in, for "This month only". */
export function monthEndInput(now: Date = new Date(), tz: string = ECONOMY_TIMEZONE): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Badge wording for when a label ends: "Ends today", "3 days left", "Ends 31 Oct". */
export function endsLabel(endsAt: Date | number, now: Date = new Date(), tz: string = ECONOMY_TIMEZONE): string {
  const end = new Date(endsAt);
  const ms = end.getTime() - now.getTime();
  const hours = ms / 3_600_000;
  if (hours <= 24) return "Ends today";
  const days = Math.ceil(hours / 24);
  if (days <= 7) return `${days} days left`;
  const last = new Date(end.getTime() - 1);
  return `Ends ${new Intl.DateTimeFormat("en-IE", { timeZone: tz, day: "numeric", month: "short" }).format(last)}`;
}
