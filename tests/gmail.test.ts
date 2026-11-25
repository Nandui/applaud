import { test } from "node:test";
import assert from "node:assert/strict";
import { sendGmail, exchangeGoogleToken, mailFailure } from "../lib/email/gmail";
import { openToken, sealToken } from "../lib/email/connection";
import { emailRecipients, sendRecognitionCopies } from "../lib/email/recognition";
import { renderNotification } from "../lib/email/template";

test("team recipients exclude the author, every honouree, duplicate mailboxes and test accounts", () => {
  const people = [
    { id: "author", name: "A", email: "a@example.org" },
    { id: "one", name: "B", email: "b@example.org" },
    { id: "two", name: "C", email: "c@example.org" },
  ];
  const staff = Array.from({ length: 51 }, (_, i) => ({ id: String(i), email: `staff${i}@example.org` }));
  const selected = emailRecipients([...people, ...staff,
    { id: "dup", email: "STAFF0@example.org" }, { id: "alias", email: "B@example.org" },
    { id: "one", email: "new@example.org" }, { id: "demo", email: "demo@yayup.test" },
  ], people);
  assert.deepEqual(selected, staff);
  assert.deepEqual(emailRecipients(people, people), []);
});

test("team announcements name the honourees, link to the post and hide the other addresses", async t => {
  let raw = "";
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    raw = Buffer.from(JSON.parse(String(init.body)).raw, "base64url").toString();
    return Response.json({ id: "sent" });
  });
  const team = { kind: "team" as const, recognisedBy: "Róisín Murphy",
    recipientNames: ["Alex <Kelly>"], recognitionId: "post-123" };
  const single = renderNotification("Yayup", team);
  assert.equal(single.subject, "Róisín gave Alex a shout-out");
  assert.match(single.html, /Alex &lt;Kelly&gt;/);
  assert.match(single.html, /href="[^"]+\/recognition\/post-123"/);
  assert.doesNotMatch(single.html, /in your wallet/);
  const multi = renderNotification("Yayup", { ...team, recipientNames: ["Alex Kelly", "Jo Lee"] });
  assert.match(multi.text, /Alex Kelly and Jo Lee/);
  await sendGmail("token", "from@example.org", "Yayup", "first@example.org", team);
  const [headers] = raw.split("\r\n\r\n");
  assert.deepEqual(headers.split("\r\n").filter(line => /^(To|Bcc|Cc):/i.test(line)), ["To: first@example.org"]);
  assert.match(headers, /Subject: =\?UTF-8\?B\?/);
});

test("provider failures expose status and reason without exposing recipient or response text", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: { message: "failed for private@example.org", errors: [{ reason: "invalidArgument" }] },
  }, { status: 400 }));
  await assert.rejects(sendGmail("test", "from@example.org", "Yayup", "to@example.org", { kind: "connected" }),
    error => mailFailure(error) === "Gmail rejected the message (HTTP 400, invalidArgument)");
  assert.equal(mailFailure(new Error("secret details")), "Error");
});

test("one Gmail rejection in an 18-person announcement leaves the other 17 deliveries independent", async t => {
  const audience = Array.from({ length: 18 }, (_, i) => ({ id: String(i), email: `person${i}@example.org` }));
  const destinations: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const raw = Buffer.from(JSON.parse(String(init.body)).raw, "base64url").toString();
    const to = raw.match(/^To: ([^\r\n]+)$/m)?.[1];
    assert.ok(to);
    destinations.push(to);
    if (to === audience[1].email) return Response.json({ error: { status: "INVALID_ARGUMENT" } }, { status: 400 });
    return Response.json({ id: `accepted-${to.split("@")[0]}` });
  });
  const accepted = t.mock.method(console, "info", () => {});
  const failed = t.mock.method(console, "error", () => {});
  await sendRecognitionCopies("r", { accessToken: "test", email: "from@example.org" }, "Yayup", audience,
    { kind: "team", recognisedBy: "Pat", recipientNames: ["Alex"], recognitionId: "r" });
  assert.deepEqual(destinations.sort(), audience.map(p => p.email).sort());
  assert.equal(accepted.mock.callCount(), 17);
  assert.equal(failed.mock.callCount(), 1);
  assert.deepEqual(failed.mock.calls[0].arguments[1], {
    kind: "team", recognitionId: "r", userId: "1", reason: "Gmail rejected the message (HTTP 400, INVALID_ARGUMENT)",
  });
});

test("a stored mailbox token is encrypted and tampering is detected", () => {
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "local-unit-test-only";
  try {
    const token = sealToken("test-refresh-token");
    assert.equal(openToken(token), "test-refresh-token");
    assert.notEqual(token, sealToken("test-refresh-token"));
    const bytes = Buffer.from(token, "base64url");
    bytes[bytes.length - 1] ^= 1;
    assert.throws(() => openToken(bytes.toString("base64url")));
  } finally {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  }
});

test("recognition email uses the connected mailbox, brand and one recipient", async t => {
  let message = "";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer test");
    message = Buffer.from(JSON.parse(String(init.body)).raw, "base64url").toString();
    return Response.json({ id: "sent" });
  });
  const id = await sendGmail("test", "sender@example.org", "Yayup", "recipient@example.org", {
    kind: "recognition", recognisedBy: "Róisín <Lee>", points: 12,
  });
  assert.equal(id, "sent");
  const [headers] = message.split("\r\n\r\n");
  assert.ok(headers.includes("From: =?UTF-8?B?WWF5dXA=?= <sender@example.org>"));
  assert.deepEqual(headers.split("\r\n").filter(h => /^(To|Cc|Bcc):/i.test(h)), ["To: recipient@example.org"]);
  const boundary = headers.match(/multipart\/alternative; boundary="([^"]+)"/)?.[1];
  assert.ok(boundary);
  const [, plain, html, end] = message.split(`--${boundary}`);
  assert.match(plain, /Content-Type: text\/plain/);
  assert.match(html, /Content-Type: text\/html/);
  assert.equal(end.trim(), "--");
  const decode = (part: string) => Buffer.from(part.split("\r\n\r\n")[1], "base64").toString();
  assert.match(decode(plain), /Róisín <Lee> recognised you/);
  assert.match(decode(html), /Róisín &lt;Lee&gt; recognised you/);
  assert.match(decode(html), /\+12 points/);
  assert.match(decode(html), /View your feed/);
  const images = [...decode(html).matchAll(/<img\b[^>]*src="([^"]+)"/gi)];
  assert.equal(images.length, 1);
  assert.ok(images[0][1].endsWith("/brand/yayup-logo.png"));
});

test("handles disabled Gmail API and expired Google authorisation", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: {
    details: [{ reason: "SERVICE_DISABLED" }],
  } }, { status: 403 }));
  await assert.rejects(sendGmail("test", "from@example.org", "Yayup", "to@example.org", { kind: "connected" }), /gmail-api-disabled/);
  await assert.rejects(exchangeGoogleToken({ refresh_token: "test", grant_type: "refresh_token" }), /403/);
});
