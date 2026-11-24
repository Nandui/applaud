import nodemailer from "nodemailer";

/**
 * Sends email through whichever service is configured:
 *  - SMTP (any mail server; for Google Workspace: SMTP_HOST=smtp.gmail.com,
 *    SMTP_PORT=465, SMTP_USER=the account, SMTP_PASS=an app password):
 *    SMTP_HOST, SMTP_PORT (default 587; 465 = TLS), SMTP_USER, SMTP_PASS
 *    (SMTP_PASSWORD also accepted), optional SMTP_SECURE=true;
 *  - otherwise Resend's HTTP API: RESEND_API_KEY.
 * The sender is EMAIL_FROM (SMTP_FROM also accepted), e.g.
 * "Yayup <hello@yayup.app>"; the service must be allowed to send from it.
 * With neither configured nothing is sent and a line is logged.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100; // Resend's batch limit

export const DEFAULT_FROM = "Yayup <hello@yayup.app>";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function emailConfigured(): boolean {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  const explicit = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (explicit) return explicit;
  // Gmail / Google Workspace only sends as the signed-in account (or its
  // aliases), so by default send as that account under the app's name.
  if (smtpConfigured() && process.env.SMTP_USER?.includes("@")) return `Yayup <${process.env.SMTP_USER}>`;
  return DEFAULT_FROM;
}

async function sendViaSmtp(emails: OutgoingEmail[], from: string): Promise<{ sent: number; error?: string }> {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "" }
      : undefined,
  });
  let sent = 0;
  try {
    for (const e of emails) {
      await transport.sendMail({ from, to: e.to, subject: e.subject, html: e.html, text: e.text });
      sent += 1;
    }
    return { sent };
  } catch (error) {
    console.error("[email] SMTP send failed", error);
    return { sent, error: `The mail server refused the message (${error instanceof Error ? error.message : "unknown error"}).` };
  } finally {
    transport.close();
  }
}

/** Sends each email on its own (nobody sees anyone else's address). */
export async function sendEmails(emails: OutgoingEmail[]): Promise<{ sent: number; error?: string }> {
  if (emails.length === 0) return { sent: 0 };
  const from = fromAddress();
  if (smtpConfigured()) return sendViaSmtp(emails, from);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] No email service configured; skipped ${emails.length} email(s): ${emails[0].subject}`);
    return { sent: 0, error: "Email isn't set up yet (no SMTP_HOST or RESEND_API_KEY)." };
  }
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          chunk.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text })),
        ),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[email] Resend ${res.status}: ${body.slice(0, 500)}`);
        return { sent, error: `The email service refused the message (${res.status}).` };
      }
      sent += chunk.length;
    } catch (error) {
      console.error("[email] send failed", error);
      return { sent, error: "Couldn't reach the email service." };
    }
  }
  return { sent };
}
