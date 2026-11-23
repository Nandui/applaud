import { test } from "node:test";
import assert from "node:assert/strict";
import { allowanceForRank, maxPointsForRank, rankCanGivePoints, rankForRole, shopIsFreeFor, shopPriceFor } from "../lib/ranks";
import { economyForecast } from "../lib/economy";

const allowances = {
  monthlyAllowanceStaff: 400,
  monthlyAllowanceManager: 1200,
  monthlyAllowanceCentreManager: 2000,
  monthlyAllowanceOperations: 3000,
  monthlyAllowanceCeo: 5000,
};

test("each rank gives from its own allowance", () => {
  assert.equal(allowanceForRank("staff", allowances), 400);
  assert.equal(allowanceForRank("manager", allowances), 1200);
  assert.equal(allowanceForRank("centre_manager", allowances), 2000);
  assert.equal(allowanceForRank("operations", allowances), 3000);
  assert.equal(allowanceForRank("ceo", allowances), 5000);
});

test("backoffice never has points to give, whatever the settings", () => {
  assert.equal(allowanceForRank("backoffice", allowances), 0);
  assert.equal(rankCanGivePoints("backoffice"), false);
  assert.equal(rankCanGivePoints("staff"), true);
  assert.equal(rankCanGivePoints("ceo"), true);
});

test("backoffice pays normal profile shop prices, like staff", () => {
  assert.equal(shopIsFreeFor("backoffice"), false);
  assert.equal(shopPriceFor("backoffice", 50), 50);
});

test("unknown ranks fall back to the staff allowance", () => {
  assert.equal(allowanceForRank("admin", allowances), 400);
  assert.equal(allowanceForRank(null, allowances), 400);
});

test("only staff use the staff limit per recognition", () => {
  const limits = { maxPointsPerShoutoutStaff: 100, maxPointsPerShoutoutManager: 300 };
  assert.equal(maxPointsForRank("staff", limits), 100);
  assert.equal(maxPointsForRank("centre_manager", limits), 300);
  assert.equal(maxPointsForRank("ceo", limits), 300);
});

test("app roles map to the rank they had before ranks existed", () => {
  assert.equal(rankForRole("staff"), "staff");
  assert.equal(rankForRole("manager"), "manager");
  assert.equal(rankForRole("admin"), "manager");
  assert.equal(rankForRole("operations"), "operations");
  assert.equal(rankForRole("ceo"), "ceo");
});

test("the worst-case month adds every rank's allowances", () => {
  const f = economyForecast(
    { ...allowances, pointsPerEuro: 100, monthlyRewardBudgetCents: 50000, monthlyBonusPool: 4400 },
    { staff: 80, backoffice: 5, manager: 6, centre_manager: 3, operations: 1, ceo: 1 },
  );
  assert.equal(f.byRank.staff, 32000);
  assert.equal(f.byRank.backoffice, 0);
  assert.equal(f.byRank.centre_manager, 6000);
  assert.equal(f.byRank.ceo, 5000);
  assert.equal(f.maxPoints, 32000 + 7200 + 6000 + 3000 + 5000 + 4400);
  assert.equal(f.maxCents, f.maxPoints);
});

test("the profile shop is free for every rank above staff", () => {
  for (const rank of ["manager", "centre_manager", "operations", "ceo"]) {
    assert.equal(shopIsFreeFor(rank), true, rank);
    assert.equal(shopPriceFor(rank, 50), 0, rank);
  }
  assert.equal(shopIsFreeFor("staff"), false);
  assert.equal(shopPriceFor("staff", 50), 50);
  // Unknown or missing ranks count as staff and pay.
  assert.equal(shopPriceFor("admin", 50), 50);
  assert.equal(shopPriceFor(null, 50), 50);
});
