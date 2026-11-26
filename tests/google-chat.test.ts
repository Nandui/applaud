import { test } from "node:test";
import assert from "node:assert/strict";
import { chatText, chatWebhookUrl, postToGoogleChat } from "../lib/chat/google-chat";

const hook = "https://chat.googleapis.com/v1/spaces/AAAA123/messages?key=k&token=t";

test("only Google Chat incoming webhook URLs are accepted", () => {
  assert.equal(chatWebhookUrl(hook), hook);
  assert.equal(chatWebhookUrl(`  ${hook}\n`), hook);
  assert.equal(chatWebhookUrl(undefined), null);
  assert.equal(chatWebhookUrl(""), null);
  assert.equal(chatWebhookUrl("http://chat.googleapis.com/v1/spaces/A/messages"), null);
  assert.equal(chatWebhookUrl("https://evil.example/v1/spaces/A/messages"), null);
  assert.equal(chatWebhookUrl("https://chat.googleapis.com/v1/spaces/A"), null);
  assert.equal(chatWebhookUrl("not a url"), null);
});

test("a recognition names everyone, the value, points and links to the post", () => {
  const text = chatText("Yayup", {
    kind: "recognition", id: "rec1", from: "Ana Byrne", to: ["Bo", "Cy"], value: "Teamwork",
    message: "Great job <b>today</b>\n& thanks", points: 50,
  });
  assert.match(text, /^🎉 \*Ana Byrne\* recognised \*Bo and Cy\* for \*Teamwork\* \(\+50 pts each\)/);
  assert.match(text, /Great job &lt;b&gt;today&lt;\/b&gt; &amp; thanks/);
  assert.match(text, /<https:\/\/yayup\.app\/recognition\/rec1\|See it in Yayup and say congrats>$/);
});

test("long messages are shortened and zero points are left out", () => {
  const text = chatText("Yayup", {
    kind: "recognition", id: "r", from: "A", to: ["B"], value: null, message: "x".repeat(1000), points: 0,
  });
  assert.ok(!text.includes("pts"));
  assert.ok(text.includes("…"));
  assert.ok(text.length < 600);
});

test("covers, awards, milestones and claims read naturally", () => {
  assert.match(chatText("Yayup", { kind: "cover", id: "c", from: "Mo", to: ["Jo"], what: "Saturday lessons", points: 200 }),
    /^🙌 \*Mo\* thanked \*Jo\* for covering Saturday lessons \(\+200 pts\)/);
  assert.match(chatText("Yayup", { kind: "award", id: "a", winner: "Jo", award: "Star of the Month", points: 1 }),
    /^🏆 \*Jo\* won \*Star of the Month\*! \(\+1 pt\)/);
  assert.match(chatText("Yayup", { kind: "milestone", id: "m", message: "🎂 Happy birthday, Jo! 🥳" }),
    /^🎂 Happy birthday, Jo! 🥳\n<https:\/\/yayup\.app\/recognition\/m\|/);
  assert.match(chatText("Yayup", { kind: "claim", person: "Jo", reward: "Cinema", points: 1500 }),
    /^🎁 \*Jo\* claimed \*Cinema\* for 1,500 pts\n<https:\/\/yayup\.app\/admin\/redemptions\|Open claims>$/);
});

test("nothing is posted outside production", async () => {
  const env = { ...process.env };
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return new Response("{}"); }) as typeof fetch;
  try {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = hook;
    process.env.VERCEL_ENV = "preview";
    await postToGoogleChat({ kind: "test", admin: "A" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
    process.env = env;
  }
});
