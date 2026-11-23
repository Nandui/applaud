import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBirthday, formatBirthday, isBirthdayOn, isoFromParts } from "../lib/birthday";

const d = (s: string) => new Date(s + "T00:00:00.000Z");
const today = d("2026-11-23");

test("isoFromParts rejects days that don't exist", () => {
  assert.equal(isoFromParts({ day: 14, month: 3, year: 1999 }), "1999-03-14");
  assert.equal(isoFromParts({ day: 29, month: 2, year: 2000 }), "2000-02-29");
  assert.equal(isoFromParts({ day: 29, month: 2, year: 2001 }), null);
  assert.equal(isoFromParts({ day: 31, month: 4, year: 2001 }), null);
});

test("checkBirthday accepts real dates in the age range", () => {
  const ok = checkBirthday("1999-03-14", today);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.date.toISOString(), "1999-03-14T00:00:00.000Z");
  assert.equal(checkBirthday("2012-11-23", today).ok, true); // exactly 14 today
  assert.equal(checkBirthday("2012-11-24", today).ok, false); // 14 tomorrow
  assert.equal(checkBirthday("1900-01-01", today).ok, false);
  assert.equal(checkBirthday("2001-02-29", today).ok, false);
  assert.equal(checkBirthday("14/03/1999", today).ok, false);
  assert.equal(checkBirthday("", today).ok, false);
});

test("isBirthdayOn matches month and day, 29 Feb on 28 Feb in other years", () => {
  assert.equal(isBirthdayOn(d("1999-03-14"), d("2026-03-14")), true);
  assert.equal(isBirthdayOn(d("1999-03-14"), d("2026-03-15")), false);
  assert.equal(isBirthdayOn(d("2000-02-29"), d("2027-02-28")), true);
  assert.equal(isBirthdayOn(d("2000-02-29"), d("2028-02-28")), false);
  assert.equal(isBirthdayOn(d("2000-02-29"), d("2028-02-29")), true);
  assert.equal(isBirthdayOn(d("1999-02-28"), d("2027-02-28")), true);
});

test("formatBirthday", () => {
  assert.equal(formatBirthday("1999-03-14"), "14 March 1999");
  assert.equal(formatBirthday(d("1999-03-14"), false), "14 March");
});
