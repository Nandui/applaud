import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canThankForCovers,
  coverAllowanceForRank,
  coverPresets,
  coveredPhrase,
} from "../lib/covers";

const settings = {
  coverAllowanceManager: 1000,
  coverAllowanceCentreManager: 1500,
  coverAllowanceOperations: 2000,
  coverAllowanceCeo: 3000,
};

test("only managers and above can thank people for covering", () => {
  for (const rank of ["manager", "centre_manager", "operations", "ceo"]) {
    assert.equal(canThankForCovers({ pointsRank: rank }), true, rank);
  }
  for (const rank of ["staff", "backoffice", "admin", null]) {
    assert.equal(canThankForCovers({ pointsRank: rank }), false, String(rank));
  }
});

test("each rank has its own cover allowance, staff and backoffice none", () => {
  assert.equal(coverAllowanceForRank("manager", settings), 1000);
  assert.equal(coverAllowanceForRank("centre_manager", settings), 1500);
  assert.equal(coverAllowanceForRank("operations", settings), 2000);
  assert.equal(coverAllowanceForRank("ceo", settings), 3000);
  assert.equal(coverAllowanceForRank("staff", settings), 0);
  assert.equal(coverAllowanceForRank("backoffice", settings), 0);
});

test("cover presets sit around the suggested amount and under the limit", () => {
  assert.deepEqual(coverPresets(200, 500), [100, 200, 400]);
  assert.deepEqual(coverPresets(200, 300), [100, 200, 300]);
  assert.deepEqual(coverPresets(200, 0), [100, 200, 400]);
  assert.deepEqual(coverPresets(100, 100), [50, 100]);
});

test("the feed says what was covered", () => {
  assert.equal(coveredPhrase("lesson"), "Covered a lesson");
  assert.equal(coveredPhrase("activity"), "Covered an activity");
  assert.equal(coveredPhrase("shift"), "Covered a shift");
  assert.equal(coveredPhrase(null), "Covered at short notice");
});
