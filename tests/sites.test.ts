import { test } from "node:test";
import assert from "node:assert/strict";
import { siteIdsOf, worksAtSite } from "../lib/sites";

test("siteIdsOf lists the main site first, then the others once", () => {
  assert.deepEqual(
    siteIdsOf({ siteId: "bt", otherSites: [{ siteId: "mah" }, { siteId: "bt" }, { siteId: "mah" }] }),
    ["bt", "mah"],
  );
  assert.deepEqual(siteIdsOf({ siteId: "bt" }), ["bt"]);
});

test("a removed person (no main site) works nowhere", () => {
  assert.deepEqual(siteIdsOf({ siteId: null, otherSites: [{ siteId: "mah" }] }), []);
});

test("worksAtSite matches the main site or another site", () => {
  assert.deepEqual(worksAtSite("mah"), {
    OR: [{ siteId: "mah" }, { otherSites: { some: { siteId: "mah" } } }],
  });
});
