import { randomUUID } from "node:crypto";
import { z } from "zod";
import { renderNotification, type Notification } from "./template";

export const gmailScope = "https://www.googleapis.com/auth/gmail.send";
export const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
export const mailbox = z.email().max(254).regex(/^[^\r\n]+$/);

class GoogleRequestError extends Error {}

// Log Google's status/reason codes, never a raw response, address, or credential.
export function mailFailure(error: unknown) {
  if (error instanceof GoogleRequestError) return error.message;
  return error instanceof Error ? error.name : "UnknownError";
}

function googleCode(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(value) ? value : "unknown";
}

export async function exchangeGoogleToken(params: Record<string, string>) {
  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new GoogleRequestError(`Google token exchange failed (HTTP ${response.status}, ${googleCode(detail?.error)})`);
  }
  return z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    scope: z.string().optional(),
  }).parse(await response.json());
}

function encodedWords(value: string) {
  const chunks = value.replace(/[\r\n]+/g, " ").trim().match(/.{1,10}/gu) ?? [];
  return chunks.map(chunk => `=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`).join("\r\n ");
}

export async function sendGmail(
  accessToken: string, sender: string, name: string, to: string,
  notification: Notification,
) {
  mailbox.parse(sender);
  mailbox.parse(to);
  const display = encodedWords([...name.trim()].slice(0, 60).join(""));
  const { subject, text, html } = renderNotification(name, notification);
  const boundary = `yayup_${randomUUID()}`;
  const parts = [["plain", text], ["html", html]].flatMap(([subtype, content]) => [
    `--${boundary}`, `Content-Type: text/${subtype}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64", "",
    ...(Buffer.from(content.replace(/\r?\n/g, "\r\n")).toString("base64").match(/.{1,76}/g) ?? []),
  ]);
  const message = [
    `From: ${display} <${sender}>`, `To: ${to}`,
    `Subject: ${notification.kind === "team" || /[^\x20-\x7e]/.test(subject) ? encodedWords(subject) : subject}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@${sender.split("@")[1]}>`,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "", ...parts, `--${boundary}--`, "",
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
  });
  if (!response.ok) {
    // Google returns SERVICE_DISABLED when Gmail hasn't been enabled in the OAuth project.
    const detail = await response.json().catch(() => null);
    if (detail?.error?.details?.some((item: { reason?: string }) => item.reason === "SERVICE_DISABLED")) {
      throw new GoogleRequestError("gmail-api-disabled");
    }
    const reason = googleCode(detail?.error?.errors?.[0]?.reason ?? detail?.error?.status);
    throw new GoogleRequestError(`Gmail rejected the message (HTTP ${response.status}, ${reason})`);
  }
  return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
}
