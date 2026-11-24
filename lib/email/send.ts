/**
 * Sends email through Resend's HTTP API (no SDK needed).
 *
 * Needs RESEND_API_KEY. The sender is EMAIL_FROM, e.g. "Yayup <hello@yayup.app>",
 * and its domain must be verified in Resend. Without a key nothing is sent and
 * a line is logged, so local dev and previews never email anyone by accident.
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

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Sends each email on its own (nobody sees anyone else's address). */
export async function sendEmails(emails: OutgoingEmail[]): Promise<{ sent: number; error?: string }> {
  if (emails.length === 0) return { sent: 0 };
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] RESEND_API_KEY not set; skipped ${emails.length} email(s): ${emails[0].subject}`);
    return { sent: 0, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  }
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
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
