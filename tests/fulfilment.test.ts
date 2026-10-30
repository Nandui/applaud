import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimStatusLabel,
  expectedByDate,
  expectedByLabel,
  fulfilmentLabel,
  isOverdue,
} from "../lib/fulfilment";

// Thursday 29 Oct 2026, 10:00 in Dublin (GMT since 25 Oct).
const thu = new Date("2026-10-29T10:00:00Z");

test("labels say how long it takes", () => {
  assert.equal(fulfilmentLabel(5, "working_days"), "Within 5 working days");
  assert.equal(fulfilmentLabel(1, "weeks"), "Within 1 week");
  assert.equal(fulfilmentLabel(0, "days"), "Same day");
  assert.equal(fulfilmentLabel(0, "hours"), "Straight away");
  assert.equal(fulfilmentLabel(null, "days"), null);
  assert.equal(fulfilmentLabel(3, "fortnights"), null);
});

test("working days skip the weekend and end at midnight Irish time", () => {
  // Thu + 2 working days = Mon 2 Nov, end of day.
  assert.equal(expectedByDate(thu, 2, "working_days")?.toISOString(), "2026-11-02T23:59:59.999Z");
  // Thu + 5 working days = Thu 5 Nov.
  assert.equal(expectedByDate(thu, 5, "working_days")?.toISOString(), "2026-11-05T23:59:59.999Z");
  // A Saturday claim: 1 working day is Monday, and "same day" is Monday too.
  const sat = new Date("2026-10-31T12:00:00Z");
  assert.equal(expectedByDate(sat, 1, "working_days")?.toISOString(), "2026-11-02T23:59:59.999Z");
  assert.equal(expectedByDate(sat, 0, "working_days")?.toISOString(), "2026-11-02T23:59:59.999Z");
  // Same day on a weekday is today.
  assert.equal(expectedByDate(thu, 0, "working_days")?.toISOString(), "2026-10-29T23:59:59.999Z");
});

test("days, weeks and hours", () => {
  assert.equal(expectedByDate(thu, 3, "days")?.toISOString(), "2026-11-01T23:59:59.999Z");
  assert.equal(expectedByDate(thu, 1, "weeks")?.toISOString(), "2026-11-05T23:59:59.999Z");
  assert.equal(expectedByDate(thu, 24, "hours")?.toISOString(), "2026-10-30T10:00:00.000Z");
  assert.equal(expectedByDate(thu, null, "days"), null);
  // In summer time the day ends an hour earlier in UTC.
  const july = new Date("2026-07-01T09:00:00Z");
  assert.equal(expectedByDate(july, 1, "days")?.toISOString(), "2026-07-02T22:59:59.999Z");
});

test("overdue only while the claim is open", () => {
  const expectedBy = new Date("2026-10-28T23:59:59.999Z");
  assert.equal(isOverdue({ status: "requested", expectedBy }, thu), true);
  assert.equal(isOverdue({ status: "approved", expectedBy }, thu), true);
  assert.equal(isOverdue({ status: "fulfilled", expectedBy }, thu), false);
  assert.equal(isOverdue({ status: "requested", expectedBy: null }, thu), false);
});

test("status names and dates read naturally", () => {
  assert.equal(claimStatusLabel("approved"), "In progress");
  assert.equal(claimStatusLabel("requested"), "Requested");
  assert.equal(expectedByLabel(new Date("2026-11-05T23:59:59.999Z")), "Thu 5 Nov");
});
