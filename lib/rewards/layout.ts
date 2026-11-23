/**
 * Where each offering lands on the staff Rewards page. Pure functions only,
 * shared by the Rewards page itself, Admin > Rewards (which shows the same
 * sections, in the same order, and lets admins drag them) and the unit tests,
 * so the admin view can never drift from what staff see.
 *
 * The page, top to bottom:
 *   1. Staff discounts (kind "discount"), in sortOrder.
 *   2. Featured: rewards with a running label, in featuredOrder (set by
 *      dragging; unplaced ones follow, most urgent label first).
 *   3. One section per category ("Other" when blank). Sections follow their
 *      first offering's sortOrder, then the name; offerings inside follow
 *      sortOrder, then price, then name.
 * A featured reward also shows in its category section.
 */
import { LEAVES_WHEN_ENDED, endDateInput, promoRank, promoState, type PromoFields } from "@/lib/reward-promo";

export const OTHER_CATEGORY = "Other";

export type LayoutFields = PromoFields & {
  id: string;
  name: string;
  category: string | null;
  sortOrder: number;
  featuredOrder: number | null;
};

export type ShopLayout<T> = {
  discounts: T[];
  featured: T[];
  categories: { name: string; items: T[] }[];
};

export function categoryOf(r: { category: string | null }): string {
  return r.category?.trim() || OTHER_CATEGORY;
}

/** The order offerings appear in within a section. */
export function compareOfferings(a: LayoutFields, b: LayoutFields): number {
  return a.sortOrder - b.sortOrder || a.pointsCost - b.pointsCost || a.name.localeCompare(b.name);
}

/** The Featured row's order: placed by an admin first, then most urgent label. */
export function compareFeatured(a: LayoutFields, b: LayoutFields, now: Date = new Date()): number {
  const fa = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
  const fb = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
  if (fa !== fb) return fa - fb;
  const [ra, ea] = promoRank(promoState(a, now));
  const [rb, eb] = promoRank(promoState(b, now));
  return ra - rb || ea - eb || compareOfferings(a, b);
}

/**
 * Sort offerings into the page's sections. Pass only what the viewer can see
 * for the live page; Admin > Rewards passes everything (hidden ones included)
 * so each keeps its place for when it comes back.
 */
export function shopLayout<T extends LayoutFields>(items: readonly T[], now: Date = new Date()): ShopLayout<T> {
  const sorted = [...items].sort(compareOfferings);
  const discounts = sorted.filter((r) => r.kind === "discount");
  const rewards = sorted.filter((r) => r.kind !== "discount");
  const featured = rewards.filter((r) => promoState(r, now).tag !== null).sort((a, b) => compareFeatured(a, b, now));

  const groups = new Map<string, { name: string; first: number; items: T[] }>();
  for (const r of rewards) {
    const name = categoryOf(r);
    const g = groups.get(name);
    if (g) g.items.push(r);
    else groups.set(name, { name, first: r.sortOrder, items: [r] });
  }
  const categories = [...groups.values()]
    .sort((a, b) => a.first - b.first || a.name.localeCompare(b.name))
    .map(({ name, items }) => ({ name, items }));
  return { discounts, featured, categories };
}

/**
 * The full offering order for saving: discounts, then each category in turn.
 * Admin > Rewards sends this after a drag, and the server numbers sortOrder
 * from it.
 */
export function flattenLayout<T extends { id: string }>(layout: Pick<ShopLayout<T>, "discounts" | "categories">): string[] {
  return [...layout.discounts, ...layout.categories.flatMap((c) => c.items)].map((r) => r.id);
}

/** Move one entry of a list by `delta` places (clamped). Returns a new list. */
export function moveItem<T>(list: readonly T[], from: number, delta: number): T[] {
  const to = Math.max(0, Math.min(list.length - 1, from + delta));
  if (to === from || from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type StatusTone = "hidden" | "warn" | "info";
export type OfferingStatus = { tone: StatusTone; text: string };

export type StatusFields = LayoutFields & {
  active: boolean;
  stock: number | null;
  monthlyStock: number | null;
  euroCostCents: number;
  claimedThisMonth: number;
  siteId: string | null;
};

/**
 * Why an offering isn't showing (tone "hidden"), shows but can't be claimed
 * ("warn"), or shows only for some people or until some day ("info"), in the
 * words Admin > Rewards puts on its badges.
 */
export function offeringStatus(
  r: StatusFields,
  ctx: { now?: Date; spentCents: number; budgetCents: number; resetsOn: string; siteName: (id: string) => string },
): OfferingStatus[] {
  const now = ctx.now ?? new Date();
  const out: OfferingStatus[] = [];
  const promo = promoState(r, now);
  const tagged = r.promoTag !== null && r.promoEndsAt !== null;

  if (!r.active) out.push({ tone: "hidden", text: "Hidden by an admin" });
  if (promo.gone) {
    out.push({ tone: "hidden", text: `Label ended ${endDateInput(r.promoEndsAt)}, so it left the shop` });
  } else if (promo.tag && tagged && LEAVES_WHEN_ENDED.includes(promo.tag)) {
    out.push({ tone: "info", text: `Leaves the shop after ${endDateInput(r.promoEndsAt)}` });
  } else if (promo.tag && tagged) {
    out.push({ tone: "info", text: `Label comes off after ${endDateInput(r.promoEndsAt)}` });
  } else if (!promo.tag && tagged) {
    out.push({ tone: "info", text: `Label ended ${endDateInput(r.promoEndsAt)}` });
  }
  if (r.siteId) out.push({ tone: "info", text: `Only staff at ${ctx.siteName(r.siteId)} see it` });

  if (r.kind !== "discount") {
    if (r.stock !== null && r.stock <= 0) {
      out.push({ tone: "warn", text: "Out of stock: shows as Sold out" });
    } else if (r.monthlyStock !== null && r.claimedThisMonth >= r.monthlyStock) {
      out.push({ tone: "warn", text: `All claimed this month, back on ${ctx.resetsOn}` });
    } else if (r.euroCostCents > 0 && ctx.spentCents + r.euroCostCents > ctx.budgetCents) {
      out.push({ tone: "warn", text: `Rewards budget used up, back on ${ctx.resetsOn}` });
    }
  }
  return out;
}

/** Whether staff can see it at all (on some site). */
export function isOnShow(r: StatusFields, now: Date = new Date()): boolean {
  return r.active && !promoState(r, now).gone;
}
