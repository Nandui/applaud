"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { WELCOME_POINTS } from "@/lib/onboarding";
import { chatConfigured, postJoinInvite } from "@/lib/chat/google-chat";
import { getGmailSender } from "@/lib/email/sender";
import { mailFailure, sendGmail } from "@/lib/email/gmail";
import { canEmail, irishTime, lastNudge, nextNudgeAt, notJoinedPeople } from "./nudge";

export type NudgeResult = { ok: true; message: string } | { ok: false; error: string };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Admin > Users "Nudge people who haven't joined": posts the invite card to
 * the Google Chat space and emails everyone with an account who has never
 * signed in (skipping anyone emailed in the last week). Only the production
 * site sends, so previews never reach real staff.
 */
export async function sendJoinNudge(): Promise<NudgeResult> {
  const admin = await requireAdmin();
  if (process.env.VERCEL_ENV !== "production") {
    return { ok: false, error: "Nudges are only sent from the live site, so previews never message real staff." };
  }

  const now = new Date();
  const next = nextNudgeAt(await lastNudge(), now);
  if (next) {
    return { ok: false, error: `A nudge went out in the last 24 hours. You can send the next one from ${irishTime(next)}.` };
  }

  let sender: Awaited<ReturnType<typeof getGmailSender>> = null;
  try {
    sender = await getGmailSender();
  } catch (error) {
    console.error("Join nudge: Gmail sender unavailable", { reason: mailFailure(error) });
  }
  if (!sender && !chatConfigured()) {
    return { ok: false, error: "Connect Gmail or Google Chat in Admin > Settings first, so the nudge has somewhere to go." };
  }

  const chat = await postJoinInvite(WELCOME_POINTS);

  const emailed: string[] = [];
  let failed = 0;
  if (sender) {
    const { appName } = await getOrgSettings();
    const people = (await notJoinedPeople()).filter((p) => canEmail(p, now));
    const concurrency = 3;
    for (let i = 0; i < people.length; i += concurrency) {
      await Promise.all(people.slice(i, i + concurrency).map(async (person) => {
        try {
          await sendGmail(sender.accessToken, sender.email, appName, person.email, {
            kind: "invite", recipientName: person.name, welcomePoints: WELCOME_POINTS,
          });
          emailed.push(person.id);
        } catch (error) {
          failed++;
          console.error("Join nudge email failed", { userId: person.id, reason: mailFailure(error) });
        }
      }));
    }
    if (emailed.length) {
      await prisma.user.updateMany({ where: { id: { in: emailed } }, data: { lastNudgedAt: now } });
    }
  }

  if (!chat && emailed.length === 0) {
    return {
      ok: false,
      error: failed
        ? "Google Chat and Gmail both refused the nudge. Check the connections in Admin > Settings."
        : "Nobody new to email, and Google Chat didn't take the post. Check the space connection in Admin > Settings.",
    };
  }

  const parts = [
    chat ? "posted the invite to Google Chat" : null,
    emailed.length ? `emailed ${plural(emailed.length, "person", "people")}` : null,
  ].filter(Boolean);
  const summary = parts.join(" and ");
  await writeAudit({
    actor: admin,
    action: "users.nudged",
    entityType: "user",
    summary: summary.charAt(0).toUpperCase() + summary.slice(1),
    metadata: { chat, emails: emailed.length, failed },
  });
  revalidatePath("/admin/users");

  const message = summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
  return { ok: true, message: failed ? `${message} ${plural(failed, "email", "emails")} couldn't be sent.` : message };
}
