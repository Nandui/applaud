import { mailbox, sendGmail } from "./gmail";
import { getGmailSender } from "./sender";

type Recipient = { id: string; email: string };

export async function notifyRecognition(recipients: Recipient[], appName: string, body: string) {
  const deliverable = recipients.filter(({ email }) => mailbox.safeParse(email).success && !email.toLowerCase().endsWith(".test"));
  if (!deliverable.length || process.env.VERCEL_ENV !== "production") return;
  try {
    const sender = await getGmailSender();
    if (!sender) return;
    await Promise.all(deliverable.map(async ({ id, email }) => {
      try {
        await sendGmail(sender.accessToken, sender.email, appName, email, "You received a recognition", body);
      } catch {
        console.error("Recognition email delivery failed for user", id);
      }
    }));
  } catch {
    console.error("Could not access the notification mailbox. Check the connection in admin settings.");
  }
}
