import { randomUUID } from "node:crypto";
import { z } from "zod";

export const gmailScope = "https://www.googleapis.com/auth/gmail.send";
export const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
export const mailbox = z.email().max(254).regex(/^[^\r\n]+$/);

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
  if (!response.ok) throw new Error(`Google token exchange failed (HTTP ${response.status})`);
  return z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    scope: z.string().optional(),
  }).parse(await response.json());
}

export async function sendGmail(
  accessToken: string, sender: string, name: string, to: string,
  subject: "You received a recognition" | "Your notification mailbox is connected" | "Notification email test", body: string,
) {
  mailbox.parse(sender);
  mailbox.parse(to);
  const words = [...name.trim()].slice(0, 60).join("").match(/.{1,10}/gu) ?? [];
  const display = words.map(word => `=?UTF-8?B?${Buffer.from(word).toString("base64")}?=`).join(" ");
  const encodedBody = Buffer.from(body.replace(/\r?\n/g, "\r\n")).toString("base64");
  const message = [
    `From: ${display} <${sender}>`, `To: ${to}`, `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@${sender.split("@")[1]}>`,
    "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", ...(encodedBody.match(/.{1,76}/g) ?? []),
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
      throw new Error("gmail-api-disabled");
    }
    throw new Error(`Gmail rejected the message (HTTP ${response.status})`);
  }
  return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
}
