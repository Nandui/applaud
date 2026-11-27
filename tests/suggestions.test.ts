import { test } from "node:test";
import assert from "node:assert/strict";
import { ideaWords, similarIdeas, isSuggestionKind, isSuggestionStatus } from "../lib/suggestions";

test("ideaWords drops filler, punctuation and simple plurals", () => {
  assert.deepEqual(ideaWords("Free cinema tickets for the team!"), ["cinema", "ticket", "team"]);
  assert.deepEqual(ideaWords("a an the"), []);
});

test("similarIdeas finds an idea while it's still being typed", () => {
  const ideas = [{ title: "Cinema tickets for two" }, { title: "Cork GAA banner" }, { title: "Spa day voucher" }];
  assert.deepEqual(similarIdeas("cine", ideas), [ideas[0]]);
  assert.deepEqual(similarIdeas("cinema ticket", ideas), [ideas[0]]);
  assert.deepEqual(similarIdeas("GAA flag banner", ideas), [ideas[1]]);
  assert.deepEqual(similarIdeas("pizza night", ideas), []);
  assert.deepEqual(similarIdeas("", ideas), []);
});

test("kind and status guards", () => {
  assert.ok(isSuggestionKind("shop"));
  assert.ok(!isSuggestionKind("other"));
  assert.ok(isSuggestionStatus("declined"));
  assert.ok(!isSuggestionStatus("done"));
});

import { itemPath, shouldAnnounce } from "../lib/suggestions";

test("only the first save as Available with an item announces the idea", () => {
  assert.equal(shouldAnnounce({ status: "added", itemId: "r1", announcedAt: null }), true);
  // Approving never tells anyone.
  assert.equal(shouldAnnounce({ status: "planned", itemId: null, announcedAt: null }), false);
  // No item linked: nothing to point people at.
  assert.equal(shouldAnnounce({ status: "added", itemId: null, announcedAt: null }), false);
  // Already announced: re-saving (a new reply, a different item) stays quiet.
  assert.equal(shouldAnnounce({ status: "added", itemId: "r2", announcedAt: new Date() }), false);
});

test("an available idea links straight to its reward or profile item", () => {
  assert.equal(itemPath("reward", "abc"), "/rewards?open=abc");
  assert.equal(itemPath("shop", "frame neon"), "/shop?open=frame%20neon");
});
