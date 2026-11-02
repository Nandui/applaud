import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextCommentReaction,
  sortThreads,
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

test("comments sort by relevance, newest first, or as posted", () => {
  const thread = (id: string, likes: number, replies: number) => ({
    comment: { id, reactions: likes ? [{ emoji: "❤️", count: likes, reacted: false }] : [] },
    replies: Array.from({ length: replies }, (_, i) => `${id}-${i}`),
  });
  const threads = [thread("a", 0, 0), thread("b", 1, 0), thread("c", 0, 1), thread("d", 1, 0)];
  const ids = (list: typeof threads) => list.map((t) => t.comment.id);
  // A reply counts double; ties keep the order posted.
  assert.deepEqual(ids(sortThreads(threads, "relevant")), ["c", "b", "d", "a"]);
  assert.deepEqual(ids(sortThreads(threads, "newest")), ["d", "c", "b", "a"]);
  assert.deepEqual(ids(sortThreads(threads, "all")), ["a", "b", "c", "d"]);
  // Live reaction counts can stand in for the page's.
  assert.deepEqual(
    ids(sortThreads(threads, "relevant", (c) => (c.id === "a" ? [{ emoji: "🔥", count: 5, reacted: true }] : c.reactions))),
    ["a", "c", "b", "d"],
  );
});
