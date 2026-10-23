import { test } from "node:test";
import assert from "node:assert/strict";
import { endDateInput, endsLabel, monthEndInput, parseEndDate, promoState } from "../lib/reward-promo";

const base = {
  kind: "reward",
  pointsCost: 300,
  wasPointsCost: null,
  promoTag: null,
  promoText: null,
  promoEndsAt: null,
};
const now = new Date("2026-10-23T09:00:00Z");

test("end dates are the last day it runs, Irish time", () => {
  // 31 Oct ends at midnight Dublin time (GMT by then) = 1 Nov 00:00 UTC.
  assert.equal(parseEndDate("2026-10-31")?.toISOString(), "2026-11-01T00:00:00.000Z");
  // In summer time it ends an hour earlier in UTC.
  assert.equal(parseEndDate("2026-07-31")?.toISOString(), "2026-07-31T23:00:00.000Z");
  assert.equal(parseEndDate("2026-02-30"), null);
  assert.equal(parseEndDate("soon"), null);
  assert.equal(endDateInput(parseEndDate("2026-10-31")), "2026-10-31");
  assert.equal(endDateInput(parseEndDate("2026-07-31")), "2026-07-31");
  assert.equal(monthEndInput(now), "2026-10-31");
  assert.equal(monthEndInput(new Date("2026-02-10T12:00:00Z")), "2026-02-28");
});

test("labels show until their end date", () => {
  const ends = new Date("2026-10-26T00:00:00Z");
  const live = promoState({ ...base, promoTag: "last_chance", promoEndsAt: ends }, now);
  assert.equal(live.tag, "last_chance");
  assert.equal(live.label, "Last chance");
  assert.equal(live.gone, false);
  const after = promoState({ ...base, promoTag: "last_chance", promoEndsAt: ends }, new Date("2026-10-26T00:00:00Z"));
  assert.equal(after.tag, null);
  assert.equal(after.gone, true, "last chance takes the reward with it");
  const featuredAfter = promoState(
    { ...base, promoTag: "featured", promoEndsAt: ends },
    new Date("2026-10-27T00:00:00Z"),
  );
  assert.equal(featuredAfter.gone, false, "featured just comes off");
  assert.equal(promoState({ ...base, promoTag: "featured", promoText: "Staff pick" }, now).label, "Staff pick");
  assert.equal(promoState({ ...base, promoTag: "bogus" }, now).tag, null);
});

test("a discounted price reverts to the usual price when the sale ends", () => {
  const sale = {
    ...base,
    promoTag: "discounted",
    wasPointsCost: 500,
    promoEndsAt: new Date("2026-11-01T00:00:00Z"),
  };
  const during = promoState(sale, now);
  assert.equal(during.pointsCost, 300);
  assert.equal(during.wasPointsCost, 500);
  const after = promoState(sale, new Date("2026-11-02T00:00:00Z"));
  assert.equal(after.pointsCost, 500);
  assert.equal(after.wasPointsCost, null);
  assert.equal(after.gone, false);
  // A "usual price" that isn't higher is no saving: no strike-through.
  assert.equal(promoState({ ...sale, wasPointsCost: 200 }, now).wasPointsCost, null);
});

test("end wording", () => {
  assert.equal(endsLabel(new Date("2026-10-23T23:00:00Z"), now), "Ends today");
  assert.equal(endsLabel(new Date("2026-10-26T00:00:00Z"), now), "3 days left");
  assert.equal(endsLabel(new Date("2026-11-01T00:00:00Z"), now), "Ends 31 Oct");
});
