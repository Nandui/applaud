import { test } from "node:test";
import assert from "node:assert/strict";
import { canEmail, nextNudgeAt } from "../lib/invite/nudge";
import { chatMessage, chatText } from "../lib/chat/google-chat";
import { renderNotification } from "../lib/email/template";

const now = new Date("2026-11-26T22:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

test("people are emailed at most once a week, and only at real addresses", () => {
  assert.equal(canEmail({ email: "aoife@leisureworldcork.com", lastNudgedAt: null }, now), true);
  assert.equal(canEmail({ email: "aoife@leisureworldcork.com", lastNudgedAt: daysAgo(3) }, now), false);
  assert.equal(canEmail({ email: "aoife@leisureworldcork.com", lastNudgedAt: daysAgo(7) }, now), true);
  assert.equal(canEmail({ email: "not an address", lastNudgedAt: null }, now), false);
});

test("the button opens again 24 hours after the last nudge", () => {
  assert.equal(nextNudgeAt(null, now), null);
  assert.equal(nextNudgeAt({ at: daysAgo(2) }, now), null);
  const next = nextNudgeAt({ at: new Date(now.getTime() - 3_600_000) }, now);
  assert.equal(next?.toISOString(), "2026-11-27T21:00:00.000Z");
});

test("the Google Chat invite lists the benefits and links to sign-in", () => {
  const message = chatMessage("Yayup", { kind: "invite", welcomePoints: 10 });
  const card = message.cardsV2[0].card;
  assert.equal(card.header.title, "Not on Yayup yet?");
  const text = card.sections[0].widgets[0].textParagraph!.text;
  assert.match(text, /Get recognised/);
  assert.match(text, /real rewards/);
  assert.match(text, /\+10 welcome points/);
  const button = card.sections[0].widgets.at(-1)!.buttonList!.buttons[0];
  assert.equal(button.text, "Join Yayup");
  assert.equal(button.onClick.openLink.url, "https://yayup.app/sign-in");
  assert.match(chatText("Yayup", { kind: "invite", welcomePoints: 0 }), /<https:\/\/yayup\.app\/sign-in\|Join Yayup/);
  assert.doesNotMatch(chatText("Yayup", { kind: "invite", welcomePoints: 0 }), /welcome points/);
});

test("the invite email greets the person by first name", () => {
  const { subject, text, html } = renderNotification("Yayup", { kind: "invite", recipientName: "Aoife <Murphy>", welcomePoints: 10 });
  assert.equal(subject, "Your team is on Yayup. Come and join in!");
  assert.match(text, /^Your team is cheering you on\./);
  assert.match(text, /Hi Aoife,/);
  assert.match(text, /10 welcome points/);
  assert.match(text, /Join Yayup: https:\/\/yayup\.app\/sign-in/);
  assert.ok(!html.includes("<Murphy>"));
});
