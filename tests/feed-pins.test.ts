import { test } from "node:test";
import assert from "node:assert/strict";
import { canPinToFeed, canUnpinFromFeed, isPinActive, pinEndsAt, pinUntilLabel } from "../lib/feed-pins";

test("managers and above, and admins, can pin to the feed", () => {
  assert.equal(canPinToFeed({ role: "staff", pointsRank: "staff" }), false);
  assert.equal(canPinToFeed({ role: "staff", pointsRank: "backoffice" }), false);
  for (const rank of ["manager", "centre_manager", "operations", "ceo"]) {
    assert.equal(canPinToFeed({ role: "staff", pointsRank: rank }), true, rank);
  }
  assert.equal(canPinToFeed({ role: "admin", pointsRank: "staff" }), true);
});

test("only the pinner or an admin can unpin", () => {
  assert.equal(canUnpinFromFeed({ id: "a", role: "manager" }, "a"), true);
  assert.equal(canUnpinFromFeed({ id: "b", role: "manager" }, "a"), false);
  assert.equal(canUnpinFromFeed({ id: "b", role: "admin" }, "a"), true);
  assert.equal(canUnpinFromFeed({ id: "b", role: "manager" }, null), false);
});

test("preset lengths and end-of-day dates (Irish time)", () => {
  const now = new Date("2026-11-27T20:00:00Z");
  const week = pinEndsAt({ duration: "1w" }, now);
  assert.ok(week.ok);
  assert.equal(week.ok && week.until.toISOString(), "2026-12-04T20:00:00.000Z");
  // Winter: Dublin is UTC, so the end of 5 Dec is midnight UTC on the 6th.
  const date = pinEndsAt({ untilDate: "2026-12-05" }, now);
  assert.equal(date.ok && date.until.toISOString(), "2026-12-06T00:00:00.000Z");
  // Summer: Dublin is UTC+1.
  const summer = pinEndsAt({ untilDate: "2027-07-10" }, new Date("2027-07-01T10:00:00Z"));
  assert.equal(summer.ok && summer.until.toISOString(), "2027-07-10T23:00:00.000Z");
  assert.equal(pinEndsAt({ untilDate: "2026-11-26" }, now).ok, false);
  assert.equal(pinEndsAt({ untilDate: "2026-02-30" }, now).ok, false);
  assert.equal(pinEndsAt({ untilDate: "2027-03-01" }, now).ok, false);
  assert.equal(pinEndsAt({ untilDate: "2026-11-27" }, now).ok, true);
});

test("pins run out on their own", () => {
  const now = new Date("2026-11-27T20:00:00Z");
  assert.equal(isPinActive(new Date("2026-11-27T20:00:01Z"), now), true);
  assert.equal(isPinActive(new Date("2026-11-27T19:59:59Z"), now), false);
  assert.equal(isPinActive(null, now), false);
});

test("labels read naturally", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  assert.equal(pinUntilLabel(new Date("2026-11-27T21:00:00Z"), now), "until 9pm");
  assert.equal(pinUntilLabel(new Date("2026-11-28T00:00:00Z"), now), "until tonight");
  assert.equal(pinUntilLabel(new Date("2026-11-28T21:30:00Z"), now), "until tomorrow 9:30pm");
  assert.equal(pinUntilLabel(new Date("2026-12-06T00:00:00Z"), now), "until Sat 5 Dec");
});
