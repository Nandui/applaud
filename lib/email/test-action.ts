"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { sendGmail } from "./gmail";
import { getGmailSender } from "./sender";

export async function sendAdminTestEmail(): Promise<string> {
  const admin = await requireAdmin();
  if (process.env.VERCEL_ENV !== "production") return "Test emails are available on the production site.";
  try {
    const sender = await getGmailSender();
    if (!sender) return "Connect a Gmail mailbox before sending a test.";
    const { appName } = await getOrgSettings();
    await sendGmail(sender.accessToken, sender.email, appName, admin.email, { kind: "test", recipientName: admin.name });
    return `Gmail accepted the test email for ${admin.email}. Look for “Notification email test” in your inbox.`;
  } catch {
    return "Couldn’t confirm the send. Check your inbox and the Gmail connection before trying again.";
  }
}
