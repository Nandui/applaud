"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { getAppUrl, loadRecognitionEmailData, postUrl } from "./recognition";
import { sendEmails } from "./send";
import { everyoneEmail, recipientEmail, type RecognitionEmailData } from "./templates";

export type SampleResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Admin > Settings "Send me both emails": the recipient email and the
 * "everyone" email for the latest recognition (or made-up sample content if
 * there is none yet), sent only to the test address.
 */
export async function sendSampleEmails(): Promise<SampleResult> {
  await requireAdmin();
  const settings = await getOrgSettings();
  const to = settings.emailTestAddress.trim();
  if (!to) return { ok: false, error: "Add a test address first, then save." };

  const appUrl = await getAppUrl();
  const latest = await prisma.recognition.findFirst({
    where: { kind: "recognition", recipients: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const loaded = latest ? await loadRecognitionEmailData(latest.id, appUrl, settings) : null;
  const data: RecognitionEmailData = loaded?.data ?? {
    appName: "Yayup",
    appUrl,
    postUrl: postUrl(appUrl, "sample"),
    kind: "recognition",
    sender: { name: "Aoife Murphy", avatarUrl: null },
    recipients: [{ name: "Sam Byrne", avatarUrl: null }],
    valueName: "Teamwork",
    valueImageUrl: null,
    coverWhat: null,
    message: "Thanks for jumping in to help with the kids' party on Saturday. You kept everyone smiling!",
    points: 50,
    imageUrl: null,
  };
  const me = data.recipients[0];

  const result = await sendEmails([
    { to, ...recipientEmail(data, me, { wouldGoTo: "each person who's recognised", sample: true }) },
    { to, ...everyoneEmail(data, { wouldGoTo: "everyone else on the app", sample: true }) },
  ]);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, message: `Sent both emails to ${to}.` };
}
