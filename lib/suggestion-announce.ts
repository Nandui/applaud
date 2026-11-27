import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { postToGoogleChat } from "@/lib/chat/google-chat";
import { emailOn } from "@/lib/email/switches";
import { getGmailSender } from "@/lib/email/sender";
import { mailFailure, sendGmail } from "@/lib/email/gmail";
import { emailRecipients } from "@/lib/email/recognition";
import { itemPath, type SuggestionKind } from "@/lib/suggestions";

/**
 * An idea is now a real reward or profile shop item: email whoever suggested
 * it and tell the staff Google Chat space, each behind its own switch in
 * Admin > Settings. Runs after the admin's save (never blocks it) and never
 * throws. Like every other Yayup email and Chat post, production only.
 */
export async function announceSuggestion(suggestionId: string): Promise<void> {
  try {
    const idea = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      select: {
        kind: true, title: true, voteCount: true, rewardId: true, cosmeticId: true,
        user: { select: { id: true, name: true, email: true, active: true } },
      },
    });
    if (!idea) return;
    const kind = idea.kind as SuggestionKind;
    const item = kind === "shop"
      ? idea.cosmeticId
        ? await prisma.cosmetic.findUnique({ where: { id: idea.cosmeticId }, select: { id: true, name: true, imageUrl: true } })
        : null
      : idea.rewardId
        ? await prisma.reward.findUnique({ where: { id: idea.rewardId }, select: { id: true, name: true, imageUrl: true } })
        : null;
    if (!item) return;
    const path = itemPath(kind, item.id);

    await Promise.all([
      postToGoogleChat({
        kind: "suggestion", area: kind, person: idea.user.name, idea: idea.title, item: item.name,
        votes: idea.voteCount, path, image: item.imageUrl?.startsWith("https://") ? item.imageUrl : null,
      }),
      emailSuggester(suggestionId, idea.user, { area: kind, idea: idea.title, item: item.name, votes: idea.voteCount, path }),
    ]);
  } catch (error) {
    console.error("Could not announce the idea", { suggestionId, reason: mailFailure(error) });
  }
}

async function emailSuggester(
  suggestionId: string,
  person: { id: string; name: string; email: string; active: boolean },
  copy: { area: SuggestionKind; idea: string; item: string; votes: number; path: string },
) {
  if (process.env.VERCEL_ENV !== "production" || !person.active) return;
  const settings = await getOrgSettings();
  if (!emailOn(settings, "suggestion")) {
    console.info("Idea email skipped: switched off in Admin > Settings", { suggestionId });
    return;
  }
  const [to] = emailRecipients([person], []);
  if (!to) return;
  const sender = await getGmailSender();
  if (!sender) {
    console.warn("Idea email skipped: no connected mailbox", { suggestionId });
    return;
  }
  try {
    const gmailId = await sendGmail(sender.accessToken, sender.email, settings.appName, to.email, {
      kind: "suggestion", recipientName: person.name, ...copy,
    });
    console.info("Gmail accepted idea email", { suggestionId, userId: person.id, gmailId });
  } catch (error) {
    console.error("Idea email send failed", { suggestionId, userId: person.id, reason: mailFailure(error) });
  }
}
