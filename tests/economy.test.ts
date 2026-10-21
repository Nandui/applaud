import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUGGESTED_REWARDS,
  checkClaim,
  daysUntilReset,
  economyMonth,
  parseEurosToCents,
  resetDateLabel,
  suggestMonthlyStock,
  suggestPointsPrice,
} from "../lib/economy";
import { BUILTIN_COSMETICS } from "../lib/cosmetics";

test("economy month follows Irish time, not UTC", () => {
  // 31 Oct 2026 23:30 UTC is still October in Dublin (GMT, +0, after DST ends).
  const winter = economyMonth(new Date("2026-10-31T23:30:00Z"));
  // 1 Oct 2026 00:00 Irish summer time (IST, +1) is 30 Sep 23:00 UTC.
  assert.equal(winter.gte.toISOString(), "2026-09-30T23:00:00.000Z");
  assert.equal(winter.lt.toISOString(), "2026-11-01T00:00:00.000Z");

  // 31 Aug 2026 23:30 UTC is 1 Sep 00:30 in Dublin: already September.
  const sept = economyMonth(new Date("2026-08-31T23:30:00Z"));
  assert.equal(sept.gte.toISOString(), "2026-08-31T23:00:00.000Z");
  assert.equal(sept.lt.toISOString(), "2026-09-30T23:00:00.000Z");

  // December rolls into January of the next year.
  const dec = economyMonth(new Date("2026-12-15T12:00:00Z"));
  assert.equal(dec.lt.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("reset countdown and label", () => {
  assert.equal(daysUntilReset(new Date("2026-10-21T21:00:00Z")), 11);
  assert.equal(daysUntilReset(new Date("2026-10-31T22:00:00Z")), 1);
  assert.equal(resetDateLabel(new Date("2026-10-21T21:00:00Z")), "1 November");
});

test("euro parsing", () => {
  assert.equal(parseEurosToCents("4.50"), 450);
  assert.equal(parseEurosToCents("€45"), 4500);
  assert.equal(parseEurosToCents("4,5"), 450);
  assert.equal(parseEurosToCents(""), 0);
  assert.equal(parseEurosToCents("-1"), null);
  assert.equal(parseEurosToCents("abc"), null);
});

test("claims stop at the monthly stock and at the budget", () => {
  const base = { euroCostCents: 4500, monthlyStock: 3, claimedThisMonth: 0, spentCents: 0, budgetCents: 50000 };
  assert.deepEqual(checkClaim(base), { ok: true });
  assert.deepEqual(checkClaim({ ...base, claimedThisMonth: 3 }), { ok: false, reason: "monthlyStock" });
  assert.deepEqual(checkClaim({ ...base, spentCents: 45500 }), { ok: true }); // exactly €500
  assert.deepEqual(checkClaim({ ...base, spentCents: 45501 }), { ok: false, reason: "budget" });
  // In-house perks cost no cash, so a spent budget doesn't block them.
  assert.deepEqual(checkClaim({ ...base, euroCostCents: 0, spentCents: 50000 }), { ok: true });
  assert.deepEqual(checkClaim({ ...base, monthlyStock: null, claimedThisMonth: 99 }), { ok: true });
});

test("profile cosmetics stay pocket change", () => {
  for (const c of BUILTIN_COSMETICS) assert.ok(c.price <= 10, `${c.id} costs ${c.price}`);
});

test("suggested rewards are priced at or above face value", () => {
  for (const r of SUGGESTED_REWARDS) {
    assert.ok(r.pointsCost >= r.euroCostCents, `${r.name} is cheaper in points than its cash cost`);
  }
});

test("advised points price is the face value rounded up to a tidy number", () => {
  assert.equal(suggestPointsPrice(300), 300); // €3 coffee
  assert.equal(suggestPointsPrice(450), 450);
  assert.equal(suggestPointsPrice(349), 350); // never below cost
  assert.equal(suggestPointsPrice(1234), 1250);
  assert.equal(suggestPointsPrice(4520), 4550);
  assert.equal(suggestPointsPrice(6020), 6100);
  assert.equal(suggestPointsPrice(300, 200), 600); // follows the conversion
  assert.equal(suggestPointsPrice(0), null); // perks are priced by feel
});

test("advised monthly stock keeps one reward to a quarter of the budget", () => {
  assert.equal(suggestMonthlyStock(4500, 50000), 2); // spa: 2 x €45 <= €125
  assert.equal(suggestMonthlyStock(300, 50000), 41);
  assert.equal(suggestMonthlyStock(90000, 50000), 1);
  assert.equal(suggestMonthlyStock(0, 50000), null);
});
