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
