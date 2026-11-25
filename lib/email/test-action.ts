"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { mailFailure, sendGmail } from "./gmail";
import { getGmailSender } from "./sender";
import type { Notification } from "./template";
import { prisma } from "@/lib/prisma";

export async function sendAdminTestEmail(recognitionId: string | null): Promise<string> {
  const admin = await requireAdmin();
  if (recognitionId !== null && (typeof recognitionId !== "string" || !recognitionId.length || recognitionId.length > 100)) {
    return "This shout-out is unavailable.";
  }
  if (process.env.VERCEL_ENV !== "production") return "Test emails are available on the production site.";
  try {
    const sender = await getGmailSender();
    if (!sender) return "Connect a Gmail mailbox before sending a test.";
    const { appName } = await getOrgSettings();
    let notification: Notification = { kind: "test", recipientName: admin.name };
    if (recognitionId) {
      const post = await prisma.recognition.findFirst({
        where: { id: recognitionId, kind: "recognition", system: false, visibility: "public", audienceSiteIds: { isEmpty: true } },
        select: { sender: { select: { name: true } }, recipients: { select: { user: { select: { name: true } } } } },
      });
      if (!post?.recipients.length) return "This shout-out is unavailable.";
      notification = { kind: "team", recognisedBy: post.sender.name, recipientNames: post.recipients.map(r => r.user.name), recognitionId };
    }
    const gmailId = await sendGmail(sender.accessToken, sender.email, appName, admin.email, notification);
    console.info("Gmail accepted admin test email", { recognitionId, kind: notification.kind, userId: admin.id, gmailId });
    if (recognitionId) return `Gmail accepted one team announcement for ${admin.email}.`;
    return `Gmail accepted the test email for ${admin.email}. Look for “Notification email test” in your inbox.`;
  } catch (error) {
    console.error("Admin test email failed", { recognitionId, userId: admin.id, reason: mailFailure(error) });
    return "Couldn’t confirm the send. Check your inbox and the Gmail connection before trying again.";
  }
}
