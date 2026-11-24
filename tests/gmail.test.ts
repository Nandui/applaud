import { test } from "node:test";
import assert from "node:assert/strict";
import { sendGmail, exchangeGoogleToken } from "../lib/email/gmail";
import { openToken, sealToken } from "../lib/email/connection";

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
  const id = await sendGmail("test", "sender@example.org", "Yayup", "recipient@example.org", "You received a recognition", "Róisín recognised you.");
  assert.equal(id, "sent");
  const [headers, body] = message.split("\r\n\r\n");
  assert.ok(headers.includes("From: =?UTF-8?B?WWF5dXA=?= <sender@example.org>"));
  assert.deepEqual(headers.split("\r\n").filter(h => /^(To|Cc|Bcc):/i.test(h)), ["To: recipient@example.org"]);
  assert.equal(Buffer.from(body, "base64").toString(), "Róisín recognised you.");
});

test("handles disabled Gmail API and expired Google authorisation", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: {
    details: [{ reason: "SERVICE_DISABLED" }],
  } }, { status: 403 }));
  await assert.rejects(sendGmail("test", "from@example.org", "Yayup", "to@example.org", "You received a recognition", "test"), /gmail-api-disabled/);
  await assert.rejects(exchangeGoogleToken({ refresh_token: "test", grant_type: "refresh_token" }), /403/);
});
