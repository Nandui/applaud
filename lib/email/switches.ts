import type { OrgSettings } from "@/lib/org-settings";

/**
 * Admin > Settings > Emails. `emailsEnabled` is the master switch: when it is
 * off nothing is emailed at all. Each kind of email also has its own switch.
 * The admin "Send a test email" button is not covered: it only ever goes to
 * the admin who presses it.
 */
export type EmailKind = "recognition" | "team" | "invite";

type EmailSwitches = Pick<OrgSettings, "emailsEnabled" | "emailRecognitions" | "emailTeamAnnouncements" | "emailInvites">;

const SWITCH: Record<EmailKind, keyof Omit<EmailSwitches, "emailsEnabled">> = {
  recognition: "emailRecognitions",
  team: "emailTeamAnnouncements",
  invite: "emailInvites",
};

export function emailOn(settings: EmailSwitches, kind: EmailKind): boolean {
  return settings.emailsEnabled && settings[SWITCH[kind]];
}
