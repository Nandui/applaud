import { test } from "node:test";
import assert from "node:assert/strict";
import { canCreatePollsAndQuestions, percentOf } from "../lib/posts/kinds";

test("only Manager, Centre manager, Operations manager, CEO ranks and admins can ask", () => {
  for (const rank of ["manager", "centre_manager", "operations", "ceo"]) {
    assert.equal(canCreatePollsAndQuestions({ role: "staff", pointsRank: rank }), true, rank);
  }
  for (const rank of ["staff", "backoffice", "", null, "nonsense"]) {
    assert.equal(canCreatePollsAndQuestions({ role: "staff", pointsRank: rank }), false, String(rank));
  }
  // App role alone doesn't count, except admin.
  assert.equal(canCreatePollsAndQuestions({ role: "manager", pointsRank: "staff" }), false);
  assert.equal(canCreatePollsAndQuestions({ role: "admin", pointsRank: "staff" }), true);
});

test("poll percentages round and survive zero votes", () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(2, 3), 67);
  assert.equal(percentOf(4, 4), 100);
});
