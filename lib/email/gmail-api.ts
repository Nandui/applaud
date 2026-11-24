import { createSign } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import type { OutgoingEmail } from "./send";

/**
 * Sends through the Gmail API as a Google Workspace user, using a Google
 * Cloud service account with domain-wide delegation (scope
 * https://www.googleapis.com/auth/gmail.send). No passwords: the service
 * account signs in "as" the sender address.
 *
 * Env (first one found wins):
 *  - GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CREDENTIALS:
 *    the whole JSON key file; or
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL (or GOOGLE_CLIENT_EMAIL) + GOOGLE_PRIVATE_KEY
 *    (or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
 *  - the Workspace user to send as: GMAIL_SENDER / GMAIL_USER /
 *    GOOGLE_IMPERSONATE_EMAIL / GOOGLE_DELEGATED_USER / GOOGLE_WORKSPACE_USER.
 */

type Credentials = { clientEmail: string; privateKey: string; sender: string };

function first(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function gmailApiCredentials(): Credentials | null {
  let clientEmail = first("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_CLIENT_EMAIL");
  let privateKey = first("GOOGLE_PRIVATE_KEY", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const json = first("GOOGLE_SERVICE_ACCOUNT_KEY", "GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CREDENTIALS");
  if (json && (!clientEmail || !privateKey)) {
    try {
      const raw = json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8");
      const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
      clientEmail ||= parsed.client_email;
      privateKey ||= parsed.private_key;
    } catch {
      console.error("[email] The Google service account key isn't valid JSON.");
    }
  }
  const sender = first("GMAIL_SENDER", "GMAIL_USER", "GOOGLE_IMPERSONATE_EMAIL", "GOOGLE_DELEGATED_USER", "GOOGLE_WORKSPACE_USER");
  if (!clientEmail || !privateKey || !sender) return null;
  // Keys pasted into env vars often carry literal "\n".
  return { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n"), sender };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(c: Credentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: c.clientEmail,
      sub: c.sender,
      scope: "https://www.googleapis.com/auth/gmail.send",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(c.privateKey))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google sign-in failed: ${body.error ?? res.status} ${body.error_description ?? ""}`.trim());
  }
  return body.access_token;
}

export async function sendViaGmailApi(
  emails: OutgoingEmail[],
  from: string,
  c: Credentials,
): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  try {
    const token = await accessToken(c);
    for (const e of emails) {
      const mime = await new MailComposer({ from, to: e.to, subject: e.subject, html: e.html, text: e.text })
        .compile()
        .build();
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: b64url(mime) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[email] Gmail API ${res.status}: ${text.slice(0, 500)}`);
        return { sent, error: `Gmail refused the message (${res.status}).` };
      }
      sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[email] Gmail API send failed", error);
    return { sent, error: error instanceof Error ? error.message : "Couldn't reach Gmail." };
  }
}
