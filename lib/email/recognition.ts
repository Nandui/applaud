import { after } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOrgSettings, type OrgSettings } from "@/lib/org-settings";
import { isTestEmail } from "@/lib/test-accounts";
import { sendEmails, type OutgoingEmail } from "./send";
import { everyoneEmail, recipientEmail, type RecognitionEmailData } from "./templates";

/**
 * The address people open from an email. APP_URL wins; on production it's the
 * project's production domain (yayup.app); otherwise the host of the request
 * that triggered the email (a preview, or localhost).
 */
export async function getAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  } catch {
    // Outside a request (scripts, crons): fall through.
  }
  return "https://yayup.app";
}

/** Link to one post in the feed (cards carry id="r-<id>"). */
export function postUrl(appUrl: string, recognitionId: string): string {
  return `${appUrl}/#r-${recognitionId}`;
}

export async function loadRecognitionEmailData(
  recognitionId: string,
  appUrl: string,
  settings: OrgSettings,
): Promise<{ data: RecognitionEmailData; recipientEmails: { name: string; email: string; avatarUrl: string | null; id: string; active: boolean }[]; senderId: string } | null> {
  const r = await prisma.recognition.findUnique({
    where: { id: recognitionId },
    select: {
      id: true,
      kind: true,
      message: true,
      imageUrls: true,
      coverWhat: true,
      senderId: true,
      sender: { select: { name: true, avatarUrl: true } },
      value: { select: { name: true, imageUrl: true } },
      recipients: {
        select: { points: true, user: { select: { id: true, name: true, email: true, avatarUrl: true, active: true } } },
      },
    },
  });
  if (!r || (r.kind !== "recognition" && r.kind !== "cover") || r.recipients.length === 0) return null;
  return {
    senderId: r.senderId,
    recipientEmails: r.recipients.map((x) => x.user),
    data: {
      // The stored name may still be the old default from before the rename.
      appName: settings.appName === "Applaud" ? "Yayup" : settings.appName,
      appUrl,
      postUrl: postUrl(appUrl, r.id),
      kind: r.kind === "cover" ? "cover" : "recognition",
      sender: { name: r.sender.name, avatarUrl: r.sender.avatarUrl },
      recipients: r.recipients.map((x) => ({ name: x.user.name, avatarUrl: x.user.avatarUrl })),
      valueName: r.value?.name ?? null,
      valueImageUrl: r.value?.imageUrl ?? null,
      coverWhat: r.coverWhat,
      message: r.message,
      points: Math.max(0, ...r.recipients.map((x) => x.points)),
      imageUrl: r.imageUrls[0] ?? null,
    },
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-IE")} ${n === 1 ? one : many}`;
}

/**
 * Builds and sends both emails for a recognition or cover thanks:
 *  - a celebratory one to each recipient;
 *  - a "someone was recognised, come and see who" one to everyone else.
 * In test mode every email goes only to the test address instead, with a note
 * saying who it would have gone to (one copy of the "everyone" email).
 */
export async function sendRecognitionEmails(recognitionId: string, appUrl: string): Promise<void> {
  const settings = await getOrgSettings();
  if (!settings.emailRecipients && !settings.emailEveryone) return;
  const testTo = settings.emailTestAddress.trim();
  if (settings.emailTestMode && !testTo) return;

  const loaded = await loadRecognitionEmailData(recognitionId, appUrl, settings);
  if (!loaded) return;
  const { data, recipientEmails, senderId } = loaded;
  const outgoing: OutgoingEmail[] = [];

  if (settings.emailRecipients) {
    for (const person of recipientEmails) {
      if (!person.active || isTestEmail(person.email)) continue;
      const me = { name: person.name, avatarUrl: person.avatarUrl };
      if (settings.emailTestMode) {
        outgoing.push({ to: testTo, ...recipientEmail(data, me, { wouldGoTo: `${person.name} (${person.email})` }) });
      } else {
        outgoing.push({ to: person.email, ...recipientEmail(data, me) });
      }
    }
  }

  if (settings.emailEveryone) {
    const skip = new Set([senderId, ...recipientEmails.map((p) => p.id)]);
    const everyone = await prisma.user.findMany({
      where: { active: true, siteId: { not: null }, id: { notIn: [...skip] } },
      select: { email: true },
    });
    const addresses = everyone.map((u) => u.email).filter((e) => e.includes("@") && !isTestEmail(e));
    if (addresses.length > 0) {
      if (settings.emailTestMode) {
        outgoing.push({
          to: testTo,
          ...everyoneEmail(data, { wouldGoTo: `${plural(addresses.length, "person", "people")} (everyone except the sender and who got it)` }),
        });
      } else {
        const email = everyoneEmail(data);
        for (const to of addresses) outgoing.push({ to, ...email });
      }
    }
  }

  const result = await sendEmails(outgoing);
  if (result.error) console.warn(`[email] recognition ${recognitionId}: ${result.error} (sent ${result.sent}/${outgoing.length})`);
}

/**
 * Call right after a recognition or cover is created. The emails go out once
 * the response has been sent, so posting stays instant, and a failure only
 * logs: it never undoes or blocks the post.
 */
export async function emailAboutRecognition(recognitionId: string | undefined): Promise<void> {
  if (!recognitionId) return;
  const appUrl = await getAppUrl();
  after(async () => {
    try {
      await sendRecognitionEmails(recognitionId, appUrl);
    } catch (error) {
      console.error(`[email] recognition ${recognitionId} failed`, error);
    }
  });
}
