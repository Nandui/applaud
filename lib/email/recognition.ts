import { mailbox, mailFailure, sendGmail } from "./gmail";
import type { Notification } from "./template";
import { getGmailSender } from "./sender";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { emailOn } from "./switches";

type Person = { id: string; email: string; name: string };

function deliverable(email: string) {
  return mailbox.safeParse(email).success && !email.toLowerCase().endsWith(".test");
}

export function emailRecipients(activeUsers: Pick<Person, "id" | "email">[], excluded: Person[]) {
  const excludedIds = new Set(excluded.map(person => person.id));
  const seen = new Set(excluded.map(person => person.email.toLowerCase()));
  const recipients: Pick<Person, "id" | "email">[] = [];
  for (const { id, email } of activeUsers) {
    const key = email.toLowerCase();
    if (excludedIds.has(id) || seen.has(key) || !deliverable(email)) continue;
    seen.add(key);
    recipients.push({ id, email });
  }
  return recipients;
}

export async function sendRecognitionCopies(
  recognitionId: string, sender: { accessToken: string; email: string }, appName: string,
  people: Pick<Person, "id" | "email">[], notification: Notification,
) {
  const concurrency = 3;
  for (let i = 0; i < people.length; i += concurrency) {
    await Promise.all(people.slice(i, i + concurrency).map(async ({ id, email }) => {
      const context = { recognitionId, userId: id, kind: notification.kind };
      try {
        const gmailId = await sendGmail(sender.accessToken, sender.email, appName, email, notification);
        console.info("Gmail accepted recognition email", { ...context, gmailId });
      } catch (error) {
        console.error("Recognition email send failed", { ...context, reason: mailFailure(error) });
      }
    }));
  }
}

export async function notifyRecognition(
  recognitionId: string, recipients: Person[], appName: string, author: Person, points: number,
) {
  if (process.env.VERCEL_ENV !== "production" || !recipients.length) return;
  try {
    const settings = await getOrgSettings();
    const personalOn = emailOn(settings, "recognition");
    const teamOn = emailOn(settings, "team");
    if (!personalOn && !teamOn) {
      console.info("Recognition emails skipped: switched off in Admin > Settings", { recognitionId });
      return;
    }
    const sender = await getGmailSender();
    if (!sender) {
      console.warn("Recognition emails skipped: no connected mailbox", { recognitionId });
      return;
    }
    if (personalOn) {
      const personal = emailRecipients(recipients, [author]);
      await sendRecognitionCopies(recognitionId, sender, appName, personal, { kind: "recognition", recognisedBy: author.name, points });
    }
    if (!teamOn) return;
    // New shout-outs are public to all active accounts, across sites.
    const staff = await prisma.user.findMany({ where: { active: true }, select: { id: true, email: true } });
    await sendRecognitionCopies(recognitionId, sender, appName, emailRecipients(staff, [author, ...recipients]), {
      kind: "team", recognisedBy: author.name, recipientNames: recipients.map(person => person.name), recognitionId,
    });
  } catch (error) {
    console.error("Could not complete recognition email delivery", { recognitionId, reason: mailFailure(error) });
  }
}
