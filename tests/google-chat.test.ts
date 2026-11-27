import { test } from "node:test";
import assert from "node:assert/strict";
import { chatMessage, chatText, chatWebhookUrl, postToGoogleChat } from "../lib/chat/google-chat";

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

test("messages are Yayup-branded cards with a violet button that opens Yayup", () => {
  const message = chatMessage("Yayup", {
    kind: "recognition", id: "rec1", from: "Ana", to: ["Bo"], value: "Teamwork",
    message: "<script>hi</script>", points: 20, image: "https://media.giphy.com/media/x/giphy.gif",
  });
  assert.match(message.fallbackText, /Ana/);
  const card = message.cardsV2[0].card;
  assert.equal(card.header.title, "New recognition");
  assert.equal(card.header.imageUrl, "https://yayup.app/brand/icon-192.png");
  const [text, image, buttons] = card.sections[0].widgets;
  assert.match(text.textParagraph!.text, /<b>Bo<\/b> was recognised by <b>Ana<\/b>/);
  assert.match(text.textParagraph!.text, /Recognised for Teamwork/);
  assert.match(text.textParagraph!.text, /&lt;script&gt;/);
  assert.ok(!text.textParagraph!.text.includes("<script>"));
  assert.equal(image.image!.imageUrl, "https://media.giphy.com/media/x/giphy.gif");
  const button = buttons.buttonList!.buttons[0];
  assert.equal(button.text, "Say congrats in Yayup");
  assert.equal(button.onClick.openLink.url, "https://yayup.app/recognition/rec1");
  // Dark enough for Google Chat to draw white text on it.
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(button.color.red) + 0.7152 * lin(button.color.green) + 0.0722 * lin(button.color.blue);
  assert.ok(luminance < 0.06, `button luminance ${luminance}`);
});

test("the test message opens Yayup's home page", () => {
  const card = chatMessage("Yayup", { kind: "test", admin: "Fern" }).cardsV2[0].card;
  const buttons = card.sections[0].widgets.at(-1)!;
  assert.equal(buttons.buttonList!.buttons[0].text, "Open Yayup");
  assert.equal(buttons.buttonList!.buttons[0].onClick.openLink.url, "https://yayup.app/");
});

test("an idea made available credits the person and opens the item", () => {
  const event = {
    kind: "suggestion", area: "shop", person: "Barrie Paine", idea: "South African flag", item: "SA flag frame",
    votes: 3, path: "/shop?open=c1", image: null,
  } as const;
  const text = chatText("Yayup", event);
  assert.match(text, /SA flag frame\* is now in the profile shop, thanks to \*Barrie Paine\*'s idea/);
  const card = chatMessage("Yayup", event).cardsV2[0].card;
  assert.equal(card.header.title, "New in the profile shop");
  const widgets = card.sections[0].widgets;
  assert.match(widgets[0].textParagraph!.text, /Suggested as “South African flag”/);
  assert.match(widgets[0].textParagraph!.text, /3 people upvoted it/);
  const button = widgets.at(-1)!.buttonList!.buttons[0];
  assert.equal(button.text, "Open Yayup");
  assert.match(button.onClick.openLink.url, /\/shop\?open=c1$/);
});
