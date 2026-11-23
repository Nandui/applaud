import { test } from "node:test";
import assert from "node:assert/strict";
import { anniversaryOf, nextServiceTier, serviceTier, serviceYears, yearsLabel } from "../lib/service";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("service years count whole years, the anniversary included", () => {
  assert.equal(serviceYears(d("2021-03-12"), d("2026-03-11")), 4);
  assert.equal(serviceYears(d("2021-03-12"), d("2026-03-12")), 5);
  assert.equal(serviceYears(d("2021-03-12"), d("2026-11-23")), 5);
  assert.equal(serviceYears(d("2026-05-01"), d("2026-11-23")), 0);
  assert.equal(serviceYears(d("2027-01-01"), d("2026-11-23")), 0);
  assert.equal(serviceYears(null), null);
});

test("each tier starts at its milestone", () => {
  assert.equal(serviceTier(0), null);
  assert.equal(serviceTier(1)?.key, "bronze");
  assert.equal(serviceTier(2)?.key, "bronze");
  assert.equal(serviceTier(3)?.key, "silver");
  assert.equal(serviceTier(9)?.key, "gold");
  assert.equal(serviceTier(10)?.key, "platinum");
  assert.equal(serviceTier(15)?.key, "diamond");
  assert.equal(serviceTier(31)?.key, "legend");
});

test("the next medal and when it arrives", () => {
  assert.equal(nextServiceTier(0)?.years, 1);
  assert.equal(nextServiceTier(5)?.years, 10);
  assert.equal(nextServiceTier(20), null);
  assert.equal(anniversaryOf(d("2021-03-12"), 10).toISOString().slice(0, 10), "2031-03-12");
  assert.equal(yearsLabel(1), "1 year");
  assert.equal(yearsLabel(7), "7 years");
});
