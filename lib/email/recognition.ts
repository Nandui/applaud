import { mailbox, sendGmail } from "./gmail";
import { getGmailSender } from "./sender";
import { prisma } from "@/lib/prisma";

type Person = { id: string; email: string; name: string };

function deliverable(email: string) {
  return mailbox.safeParse(email).success && !email.toLowerCase().endsWith(".test");
}

export function teamEmailBatches(activeUsers: Pick<Person, "id" | "email">[], excluded: Person[]) {
  const excludedIds = new Set(excluded.map(person => person.id));
  const seen = new Set(excluded.map(person => person.email.toLowerCase()));
  const addresses: string[] = [];
  for (const { id, email } of activeUsers) {
    const key = email.toLowerCase();
    if (excludedIds.has(id) || seen.has(key) || !deliverable(email)) continue;
    seen.add(key);
    addresses.push(email);
  }
  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 50) batches.push(addresses.slice(i, i + 50));
  return batches;
}

export async function notifyRecognition(
  recognitionId: string, recipients: Person[], appName: string, author: Person, points: number,
) {
  if (process.env.VERCEL_ENV !== "production" || !recipients.length) return;
  try {
    const sender = await getGmailSender();
    if (!sender) return;
    const personal = recipients.filter(person => person.id !== author.id && deliverable(person.email));
    await Promise.all(personal.map(async ({ id, email }) => {
      try {
        await sendGmail(sender.accessToken, sender.email, appName, email, {
          kind: "recognition", recognisedBy: author.name, points,
        });
      } catch {
        console.error("Recognition email delivery failed for user", id);
      }
    }));
    // New shout-outs are public to all active accounts, across sites.
    const staff = await prisma.user.findMany({ where: { active: true }, select: { id: true, email: true } });
    const recipientNames = recipients.map(person => person.name);
    for (const bcc of teamEmailBatches(staff, [author, ...recipients])) {
      try {
        await sendGmail(sender.accessToken, sender.email, appName, { bcc }, {
          kind: "team", recognisedBy: author.name, recipientNames, recognitionId,
        });
      } catch {
        console.error("Team recognition email batch failed", { recognitionId, recipientCount: bcc.length });
      }
    }
  } catch {
    console.error("Could not access the notification mailbox. Check the connection in admin settings.");
  }
}
