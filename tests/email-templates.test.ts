import { test } from "node:test";
import assert from "node:assert/strict";
import { everyoneEmail, recipientEmail, type RecognitionEmailData } from "../lib/email/templates";

const data: RecognitionEmailData = {
  appName: "Yayup",
  appUrl: "https://yayup.app",
  postUrl: "https://yayup.app/#r-abc",
  kind: "recognition",
  sender: { name: "Aoife Murphy", avatarUrl: null },
  recipients: [
    { name: "Sam Byrne", avatarUrl: "/avatars/sam.png" },
    { name: "Ciara Walsh", avatarUrl: null },
  ],
  valueName: "Teamwork",
  valueImageUrl: null,
  coverWhat: null,
  message: `Great <b>work</b> & "thanks"`,
  points: 50,
  imageUrl: null,
};

test("recipient email names the sender, value, points and the others", () => {
  const e = recipientEmail(data, data.recipients[0]);
  assert.equal(e.subject, "🎉 Aoife Murphy recognised you for Teamwork");
  assert.match(e.html, /You&#39;ve been recognised, Sam!/);
  assert.match(e.html, /\+50 points/);
  assert.match(e.html, /Shared with Ciara/);
  assert.match(e.html, /https:\/\/yayup\.app\/avatars\/sam\.png/);
  assert.match(e.html, /https:\/\/yayup\.app\/#r-abc/);
  assert.doesNotMatch(e.html, /Test email/);
});

test("the message is escaped", () => {
  const e = recipientEmail(data, data.recipients[0]);
  assert.doesNotMatch(e.html, /<b>work<\/b>/);
  assert.match(e.html, /Great &lt;b&gt;work&lt;\/b&gt; &amp; &quot;thanks&quot;/);
});

test("everyone email keeps who it was a secret", () => {
  const e = everyoneEmail(data);
  assert.doesNotMatch(e.html, /Sam|Ciara/);
  assert.doesNotMatch(e.text, /Sam|Ciara/);
  assert.doesNotMatch(e.html, /Great/);
  assert.match(e.html, /2 colleagues/);
  assert.match(e.html, /See who they are/);
});

test("test mode note says who it would have gone to", () => {
  const e = everyoneEmail(data, { wouldGoTo: "87 people" });
  assert.match(e.html, /Test email\./);
  assert.match(e.html, /this goes to 87 people/);
});

test("cover thanks reads naturally", () => {
  const cover = { ...data, kind: "cover" as const, valueName: null, coverWhat: "the 6pm swim lesson" };
  const e = recipientEmail(cover, cover.recipients[1]);
  assert.equal(e.subject, "🙌 Aoife Murphy thanked you for covering");
  assert.match(e.html, /thanked you for covering the 6pm swim lesson at short notice/);
});
