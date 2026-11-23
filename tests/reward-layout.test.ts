import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenLayout, moveItem, offeringStatus, shopLayout } from "../lib/rewards/layout";

const now = new Date("2026-11-23T12:00:00Z");
const later = new Date("2026-12-31T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");

function r(id: string, extra: Partial<Parameters<typeof shopLayout>[0][number]> & Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    kind: "reward",
    category: null as string | null,
    pointsCost: 100,
    wasPointsCost: null,
    promoTag: null as string | null,
    promoText: null,
    promoEndsAt: null as Date | null,
    sortOrder: 0,
    featuredOrder: null as number | null,
    ...extra,
  };
}

test("untouched catalogue keeps the old order: categories A to Z, cheapest first", () => {
  const l = shopLayout(
    [
      r("pt", { category: "Perks", pointsCost: 1500 }),
      r("coffee", { category: "Treats", pointsCost: 300 }),
      r("pass", { category: "Perks", pointsCost: 600 }),
      r("loose"),
    ],
    now,
  );
  assert.deepEqual(
    l.categories.map((c) => [c.name, c.items.map((i) => i.id)]),
    [
      ["Other", ["loose"]],
      ["Perks", ["pass", "pt"]],
      ["Treats", ["coffee"]],
    ],
  );
});

test("sortOrder decides offerings and categories follow their first offering", () => {
  const l = shopLayout(
    [
      r("a", { category: "Perks", sortOrder: 30 }),
      r("b", { category: "Treats", sortOrder: 10 }),
      r("c", { category: "Perks", sortOrder: 20 }),
      r("d", { kind: "discount", sortOrder: 40 }),
      r("e", { kind: "discount", sortOrder: 5 }),
    ],
    now,
  );
  assert.deepEqual(l.discounts.map((i) => i.id), ["e", "d"]);
  assert.deepEqual(l.categories.map((c) => c.name), ["Treats", "Perks"]);
  assert.deepEqual(l.categories[1].items.map((i) => i.id), ["c", "a"]);
  assert.deepEqual(flattenLayout(l), ["e", "d", "b", "c", "a"]);
});

test("Featured: placed ones first, then most urgent label; ended labels drop out", () => {
  const l = shopLayout(
    [
      r("feat", { promoTag: "featured" }),
      r("last", { promoTag: "last_chance", promoEndsAt: later }),
      r("placed", { promoTag: "featured", featuredOrder: 1 }),
      r("ended", { promoTag: "limited", promoEndsAt: past }),
      r("plain"),
      r("disc", { kind: "discount", promoTag: "featured" }),
    ],
    now,
  );
  assert.deepEqual(l.featured.map((i) => i.id), ["placed", "last", "feat"]);
});

test("moveItem moves and clamps", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, -5), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});

test("status badges explain why something is hidden or can't be claimed", () => {
  const ctx = { now, spentCents: 49_900, budgetCents: 50_000, resetsOn: "1 December", siteName: () => "Mallow" };
  const base = { active: true, stock: null, monthlyStock: null, euroCostCents: 0, claimedThisMonth: 0, siteId: null };
  const texts = (extra: Record<string, unknown>) =>
    offeringStatus({ ...r("x"), ...base, ...extra } as never, ctx).map((s) => `${s.tone}:${s.text}`);

  assert.deepEqual(texts({}), []);
  assert.deepEqual(texts({ active: false }), ["hidden:Hidden by an admin"]);
  assert.deepEqual(texts({ promoTag: "month_only", promoEndsAt: past }), [
    "hidden:Label ended 2026-10-31, so it left the shop",
  ]);
  assert.deepEqual(texts({ promoTag: "last_chance", promoEndsAt: later }), [
    "info:Leaves the shop after 2026-12-30",
  ]);
  assert.deepEqual(texts({ stock: 0 }), ["warn:Out of stock: shows as Sold out"]);
  assert.deepEqual(texts({ monthlyStock: 4, claimedThisMonth: 4 }), [
    "warn:All claimed this month, back on 1 December",
  ]);
  assert.deepEqual(texts({ euroCostCents: 500 }), ["warn:Rewards budget used up, back on 1 December"]);
  assert.deepEqual(texts({ siteId: "s1" }), ["info:Only staff at Mallow see it"]);
});
