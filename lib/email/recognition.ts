import { prisma } from "@/lib/prisma";
import { exchangeGoogleToken, mailbox, sendGmail } from "./gmail";
import { openToken } from "./connection";

type Recipient = { id: string; email: string };

export async function notifyRecognition(recipients: Recipient[], appName: string, body: string) {
  const deliverable = recipients.filter(({ email }) => mailbox.safeParse(email).success && !email.toLowerCase().endsWith(".test"));
  if (!deliverable.length || process.env.VERCEL_ENV !== "production") return;
  try {
    const connection = await prisma.gmailConnection.findUnique({ where: { id: "singleton" } });
    if (!connection) return;
    const token = await exchangeGoogleToken({
      grant_type: "refresh_token", refresh_token: openToken(connection.encryptedToken),
    });
    await Promise.all(deliverable.map(async ({ id, email }) => {
      try {
        await sendGmail(token.access_token, connection.email, appName, email, "You received a recognition", body);
      } catch {
        console.error("Recognition email delivery failed for user", id);
      }
    }));
  } catch {
    console.error("Could not access the notification mailbox. Check the connection in admin settings.");
  }
}
