import { test } from "node:test";
import assert from "node:assert/strict";
import { chatText } from "../lib/chat/google-chat";
import { renderNotification } from "../lib/email/template";
import { shortNameList } from "../lib/format";

const many = Array.from({ length: 45 }, (_, i) => `Person ${i + 1}`);

test("long name lists collapse to a few names and a count", () => {
  assert.deepEqual(shortNameList(["A"]), ["A"]);
  assert.deepEqual(shortNameList(["A", "B", "C", "D"]), ["A", "B", "C", "D"]);
  assert.deepEqual(shortNameList(["A", "B", "C", "D", "E"]), ["A", "B", "C", "2 others"]);
  assert.deepEqual(shortNameList(many).at(-1), "42 others");
});

test("a whole-group recognition posts one short Chat line, not 45 names", () => {
  const listed = chatText("Yayup", {
    kind: "recognition", id: "r", from: "Ana", to: many, value: null, message: "Thanks all", points: 2,
  });
  assert.match(listed, /recognised \*Person 1, Person 2, Person 3 and 42 others\* \(\+2 pts each\)/);
  assert.doesNotMatch(listed, /Person 45/);

  const group = chatText("Yayup", {
    kind: "recognition", id: "r", from: "Ana", to: many, value: null, message: "Thanks all", points: 2,
    audience: "everyone at Mahon",
  });
  assert.match(group, /recognised \*everyone at Mahon \(45 people\)\* \(\+2 pts each\)/);
});

test("the team email names the group instead of listing everyone", () => {
  const listed = renderNotification("Yayup", {
    kind: "team", recognisedBy: "Ana Byrne", recipientNames: many, recognitionId: "r",
  });
  assert.match(JSON.stringify(listed), /Person 1, Person 2, Person 3 and 42 others/);
  assert.doesNotMatch(JSON.stringify(listed), /Person 45/);

  const group = renderNotification("Yayup", {
    kind: "team", recognisedBy: "Ana Byrne", recipientNames: many, recognitionId: "r", audience: "everyone",
  });
  assert.match(JSON.stringify(group), /Ana Byrne recognised everyone \(45 people\)/);
});
