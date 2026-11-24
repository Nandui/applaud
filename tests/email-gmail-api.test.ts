import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { gmailApiCredentials, sendViaGmailApi } from "../lib/email/gmail-api";

test("signs in as the sender and sends each email through the Gmail API", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: "bot@proj.iam.gserviceaccount.com", private_key: pem.replace(/\n/g, "\\n") });
  process.env.GMAIL_SENDER = "yayup@example.com";
  const creds = gmailApiCredentials();
  assert.ok(creds);
  assert.equal(creds.sender, "yayup@example.com");

  const calls: { url: string; body: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: String(init.body) });
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const r = await sendViaGmailApi([{ to: "a@example.com", subject: "Hi 🎉", html: "<b>x</b>", text: "x" }], "Yayup <yayup@example.com>", creds);
    assert.deepEqual(r, { sent: 1 });
  } finally {
    globalThis.fetch = realFetch;
  }
  const jwt = new URLSearchParams(calls[0].body).get("assertion")!;
  const [h, c, sig] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.sub, "yayup@example.com");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/gmail.send");
  const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, "base64url")));
  const raw = Buffer.from(JSON.parse(calls[1].body).raw, "base64url").toString();
  assert.match(raw, /To: a@example\.com/);
  assert.match(raw, /From: Yayup <yayup@example\.com>/);
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GMAIL_SENDER;
});
