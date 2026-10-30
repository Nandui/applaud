import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRunVote,
  firstOpening,
  nextOpening,
  parseOpeningDate,
  roundLabel,
  toDateInput,
} from "../lib/votes/schedule";
import { parseVoteSchedule } from "../lib/votes/form";

test("votes open at 09:00 Irish time, summer and winter", () => {
  // Winter: Dublin is UTC.
  assert.equal(parseOpeningDate("2026-12-01")?.toISOString(), "2026-12-01T09:00:00.000Z");
  // Summer: Dublin is UTC+1.
  assert.equal(parseOpeningDate("2026-07-01")?.toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(parseOpeningDate("2026-02-30"), null);
  assert.equal(parseOpeningDate("soon"), null);
  assert.equal(toDateInput(parseOpeningDate("2026-07-01")), "2026-07-01");
});

test("the schedule repeats on the same day, clamping short months", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const jan31 = parseOpeningDate("2026-01-31")!;
  assert.equal(toDateInput(nextOpening(jan31, "month", now)), "2026-02-28");
  assert.equal(toDateInput(nextOpening(parseOpeningDate("2026-11-15")!, "quarter", now)), "2027-02-15");
  assert.equal(toDateInput(nextOpening(parseOpeningDate("2026-10-26")!, "week", now)), "2026-11-02");
  // Across the clocks going back, still 09:00 local.
  assert.equal(nextOpening(parseOpeningDate("2026-10-01")!, "month", now).toISOString(), "2026-11-01T09:00:00.000Z");
});

test("a schedule missed for months opens once, at the next future date", () => {
  const from = parseOpeningDate("2026-01-01")!;
  const now = new Date("2026-05-10T12:00:00Z");
  assert.equal(toDateInput(nextOpening(from, "month", now)), "2026-06-01");
});

test("a new schedule starts next week, month or quarter", () => {
  const now = new Date("2026-10-30T11:00:00Z"); // a Friday
  assert.equal(toDateInput(firstOpening("week", now)), "2026-11-02");
  assert.equal(toDateInput(firstOpening("month", now)), "2026-11-01");
  assert.equal(toDateInput(firstOpening("quarter", now)), "2027-01-01");
  // On a Monday, "next week" is the Monday after.
  assert.equal(toDateInput(firstOpening("week", new Date("2026-11-02T10:00:00Z"))), "2026-11-09");
});

test("round names", () => {
  const at = parseOpeningDate("2026-11-03")!;
  assert.equal(roundLabel(at, "month"), "November 2026");
  assert.equal(roundLabel(at, "week"), "Week of 3 Nov");
  assert.equal(roundLabel(at, "quarter"), "Q4 2026");
  assert.equal(roundLabel(at, null), "November 2026");
});

test("admins and the award's own role run its vote", () => {
  assert.equal(canRunVote("admin", "ceo"), true);
  assert.equal(canRunVote("ceo", "ceo"), true);
  assert.equal(canRunVote("manager", "ceo"), false);
  assert.equal(canRunVote("staff", "admin"), false);
});

test("vote schedule form", () => {
  const now = new Date("2026-10-30T11:00:00Z");
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  const off = parseVoteSchedule(fd({ voteEvery: "off", voteDays: "7" }), now);
  assert.deepEqual(off, { ok: true, data: { voteEvery: null, voteDays: 7, nextVoteAt: null } });

  const monthly = parseVoteSchedule(fd({ voteEvery: "month", voteDays: "5", nextVoteOn: "" }), now);
  assert.ok(monthly.ok && toDateInput(monthly.data.nextVoteAt) === "2026-11-01");

  // Weekly votes can't stay open past the next one.
  assert.equal(parseVoteSchedule(fd({ voteEvery: "week", voteDays: "8" }), now).ok, false);
  assert.equal(parseVoteSchedule(fd({ voteEvery: "month", voteDays: "7", nextVoteOn: "2026-10-01" }), now).ok, false);
  // Today, after 09:00: opens straight away.
  const today = parseVoteSchedule(fd({ voteEvery: "month", voteDays: "7", nextVoteOn: "2026-10-30" }), now);
  assert.ok(today.ok && today.data.nextVoteAt?.getTime() === now.getTime());
});
