import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextCommentReaction,
  reactionsByComment,
  summarizeCommentReactions,
  threadComments,
  withMyReaction,
} from "../lib/recognition/comment-reactions";

test("reactions group per emoji in a fixed order and mark mine", () => {
  const list = summarizeCommentReactions(
    [
      { emoji: "😂", userId: "a" },
      { emoji: "❤️", userId: "b" },
      { emoji: "😂", userId: "me" },
    ],
    "me",
  );
  assert.deepEqual(list, [
    { emoji: "❤️", count: 1, reacted: false },
    { emoji: "😂", count: 2, reacted: true },
  ]);
});

test("reactions are grouped by comment", () => {
  const map = reactionsByComment(
    [
      { commentId: "c1", emoji: "❤️", userId: "a" },
      { commentId: "c2", emoji: "🔥", userId: "me" },
    ],
    "me",
  );
  assert.deepEqual(Object.keys(map).sort(), ["c1", "c2"]);
  assert.equal(map.c2[0].reacted, true);
});

test("tapping my emoji takes it back, another switches", () => {
  const list = [
    { emoji: "❤️", count: 2, reacted: true },
    { emoji: "😂", count: 1, reacted: false },
  ];
  assert.equal(nextCommentReaction(list, "❤️"), null);
  assert.equal(nextCommentReaction(list, "😂"), "😂");
  assert.deepEqual(withMyReaction(list, "😂"), [
    { emoji: "❤️", count: 1, reacted: false },
    { emoji: "😂", count: 2, reacted: true },
  ]);
  assert.deepEqual(withMyReaction([{ emoji: "❤️", count: 1, reacted: true }], null), []);
  assert.deepEqual(withMyReaction([], "🔥"), [{ emoji: "🔥", count: 1, reacted: true }]);
});

test("replies sit under their comment; orphans stay visible", () => {
  const threads = threadComments([
    { id: "a", parentId: null },
    { id: "b", parentId: null },
    { id: "a1", parentId: "a" },
    { id: "x1", parentId: "missing" },
    { id: "a2", parentId: "a" },
  ]);
  assert.deepEqual(
    threads.map((t) => [t.comment.id, t.replies.map((r) => r.id)]),
    [
      ["a", ["a1", "a2"]],
      ["b", []],
      ["x1", []],
    ],
  );
});
