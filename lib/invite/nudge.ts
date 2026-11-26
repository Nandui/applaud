import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { TEST_EMAIL_DOMAIN } from "@/lib/test-accounts";
import { mailbox } from "@/lib/email/gmail";

/**
 * "Nudge people who haven't joined" (Admin > Users).
 *
 * Someone "hasn't joined" when they have an active Yayup account at a site but
 * have never signed in with Google (no Account row). Staff with no account at
 * all can't be listed, which is why the nudge also posts an invite card to the
 * all-staff Google Chat space.
 *
 * To keep it friendly rather than spammy, the button can be pressed once every
 * NUDGE_COOLDOWN_HOURS, and a person is emailed at most once every
 * EMAIL_GAP_DAYS however often it is pressed.
 */

export const NUDGE_COOLDOWN_HOURS = 24;
export const EMAIL_GAP_DAYS = 7;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const notJoinedWhere = {
  active: true,
  siteId: { not: null },
  accounts: { none: {} },
  NOT: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}`, mode: "insensitive" } },
} satisfies Prisma.UserWhereInput;

export type LastNudge = {
  at: Date;
  by: string;
  emails: number;
  chat: boolean;
};

export type NudgePerson = { id: string; name: string; email: string; lastNudgedAt: Date | null };

/** Can this person get the email now (valid address, not emailed recently)? */
export function canEmail(person: Pick<NudgePerson, "email" | "lastNudgedAt">, now: Date): boolean {
  if (!mailbox.safeParse(person.email).success) return false;
  return !person.lastNudgedAt || now.getTime() - person.lastNudgedAt.getTime() >= EMAIL_GAP_DAYS * DAY;
}

/** When the button can be pressed again after the last nudge, or null if it can now. */
export function nextNudgeAt(last: Pick<LastNudge, "at"> | null, now: Date): Date | null {
  if (!last) return null;
  const next = new Date(last.at.getTime() + NUDGE_COOLDOWN_HOURS * HOUR);
  return next > now ? next : null;
}

/** "Thu 26 Nov, 21:50" in Irish time, whatever the server's time zone. */
export function irishTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

function readMeta(value: unknown): { emails: number; chat: boolean } {
  const meta = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    emails: typeof meta.emails === "number" ? meta.emails : 0,
    chat: meta.chat === true,
  };
}

export async function lastNudge(): Promise<LastNudge | null> {
  const event = await prisma.auditEvent.findFirst({
    where: { action: "users.nudged" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadata: true, actor: { select: { name: true } }, actorEmail: true },
  });
  if (!event) return null;
  return {
    at: event.createdAt,
    by: event.actor?.name ?? event.actorEmail ?? "an admin",
    ...readMeta(event.metadata),
  };
}

export async function notJoinedPeople(): Promise<NudgePerson[]> {
  return prisma.user.findMany({
    where: notJoinedWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, lastNudgedAt: true },
  });
}
