import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anniversaryOf,
  medalFigure,
  nextServiceTier,
  serviceLabel,
  serviceMonths,
  serviceTier,
} from "../lib/service";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("service counts whole months, the monthly anniversary included", () => {
  assert.equal(serviceMonths(d("2026-05-23"), d("2026-11-22")), 5);
  assert.equal(serviceMonths(d("2026-05-23"), d("2026-11-23")), 6);
  assert.equal(serviceMonths(d("2021-03-12"), d("2026-03-12")), 60);
  assert.equal(serviceMonths(d("2021-03-12"), d("2026-03-11")), 59);
  assert.equal(serviceMonths(d("2027-01-01"), d("2026-11-23")), 0);
  assert.equal(serviceMonths(null), null);
});

test("medals at 6 months, every year to 5, then 10, 15 and 20", () => {
  assert.equal(serviceTier(5), null);
  assert.equal(serviceTier(6)?.key, "steel");
  assert.equal(serviceTier(12)?.key, "bronze");
  assert.equal(serviceTier(24)?.key, "copper");
  assert.equal(serviceTier(36)?.key, "silver");
  assert.equal(serviceTier(48)?.key, "rosegold");
  assert.equal(serviceTier(119)?.key, "gold");
  assert.equal(serviceTier(120)?.key, "platinum");
  assert.equal(serviceTier(180)?.key, "diamond");
  assert.equal(serviceTier(400)?.key, "legend");
});

test("the next medal, when it arrives and how it reads", () => {
  assert.equal(nextServiceTier(0)?.months, 6);
  assert.equal(nextServiceTier(60)?.months, 120);
  assert.equal(nextServiceTier(240), null);
  assert.equal(anniversaryOf(d("2021-03-12"), 120).toISOString().slice(0, 10), "2031-03-12");
  assert.equal(anniversaryOf(d("2026-05-23"), 6).toISOString().slice(0, 10), "2026-11-23");
  assert.equal(serviceLabel(6), "6 months");
  assert.equal(serviceLabel(12), "1 year");
  assert.equal(serviceLabel(89), "7 years");
  assert.deepEqual(medalFigure(6), { value: 6, unit: "MONTHS" });
  assert.deepEqual(medalFigure(277), { value: 23, unit: "YEARS" });
});
