"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { updateOrgSettings, type ActionResult } from "@/lib/settings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type SettingsData = {
  appName: string;
  allowSelfRecognition: boolean;
  autoCreateGoogleUsers: boolean;
  chatRecognitions: boolean;
  chatCovers: boolean;
  chatAwards: boolean;
  chatMilestones: boolean;
  chatRewardClaims: boolean;
  chatSuggestions: boolean;
  emailsEnabled: boolean;
  emailRecognitions: boolean;
  emailTeamAnnouncements: boolean;
  emailInvites: boolean;
  emailSuggestions: boolean;
};

type EmailKey = "emailRecognitions" | "emailTeamAnnouncements" | "emailInvites" | "emailSuggestions";

const EMAIL_KINDS: { key: EmailKey; label: string; hint: string }[] = [
  { key: "emailRecognitions", label: "To the people recognised", hint: "A personal email when someone recognises them." },
  { key: "emailTeamAnnouncements", label: "Recognition news to everyone else", hint: "“Someone was just recognised” to every other active person." },
  { key: "emailInvites", label: "Join invites", hint: "The emails sent by “Nudge people to join” in Users." },
  { key: "emailSuggestions", label: "Ideas now available", hint: "Tells whoever suggested an idea when it’s added to Rewards or the profile shop." },
];

type ChatKey = "chatRecognitions" | "chatCovers" | "chatAwards" | "chatMilestones" | "chatRewardClaims" | "chatSuggestions";

const CHAT_EVENTS: { key: ChatKey; label: string; hint: string }[] = [
  { key: "chatRecognitions", label: "New recognitions", hint: "Who recognised whom, the value and the message." },
  { key: "chatCovers", label: "Thanks for covering", hint: "When a manager thanks someone for a last-minute cover." },
  { key: "chatAwards", label: "Award winners", hint: "When someone wins an award." },
  { key: "chatMilestones", label: "Birthdays and work anniversaries", hint: "The same celebrations posted in the feed." },
  { key: "chatSuggestions", label: "Staff ideas now available", hint: "A new reward or profile item added thanks to someone’s idea." },
  { key: "chatRewardClaims", label: "Reward claims", hint: "Who claimed which reward. Best for an admins-only space." },
];

export function SettingsForm({ settings, chatConnected }: { settings: SettingsData; chatConnected: boolean }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateOrgSettings, undefined);
  const [allowSelf, setAllowSelf] = useState(settings.allowSelfRecognition);
  const [autoCreate, setAutoCreate] = useState(settings.autoCreateGoogleUsers);
  const [chat, setChat] = useState<Record<ChatKey, boolean>>(() =>
    Object.fromEntries(CHAT_EVENTS.map(({ key }) => [key, settings[key]])) as Record<ChatKey, boolean>,
  );

  const [emailsEnabled, setEmailsEnabled] = useState(settings.emailsEnabled);
  const [emails, setEmails] = useState<Record<EmailKey, boolean>>(() =>
    Object.fromEntries(EMAIL_KINDS.map(({ key }) => [key, settings[key]])) as Record<EmailKey, boolean>,
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="allowSelfRecognition" value={String(allowSelf)} />
      <input type="hidden" name="autoCreateGoogleUsers" value={String(autoCreate)} />
      {CHAT_EVENTS.map(({ key }) => (
        <input key={key} type="hidden" name={key} value={String(chat[key])} />
      ))}
      <input type="hidden" name="emailsEnabled" value={String(emailsEnabled)} />
      {EMAIL_KINDS.map(({ key }) => (
        <input key={key} type="hidden" name={key} value={String(emails[key])} />
      ))}

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appName">App name</Label>
            <Input id="appName" name="appName" defaultValue={settings.appName} required />
            <p className="text-muted text-xs">Shown in the UI and emails.</p>
          </div>
          <p className="text-muted text-sm">
            Points, allowances, the euro conversion, the rewards budget and year-end expiry live in{" "}
            <Link href="/admin/economy" className="text-primary font-medium">
              Economy
            </Link>
            .
          </p>
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Allow self-recognition</p>
              <p className="text-muted text-xs">Let people recognise themselves.</p>
            </div>
            <Switch checked={allowSelf} onCheckedChange={setAllowSelf} />
          </div>
          <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                Create accounts automatically for company Google sign-ins
              </p>
              <p className="text-muted text-xs">
                Someone signing in with a work Google account for the first time gets a
                staff account straight away. They show as New in{" "}
                <Link href="/admin/users" className="text-primary font-medium">
                  Users
                </Link>{" "}
                so you can check their role and site. When off, only people already in
                Users can sign in.
              </p>
            </div>
            <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
          </div>
        </CardContent>
      </Card>

      <Card id="emails">
        <CardContent className="space-y-3">
          <div>
            <h2 className="font-semibold">Emails</h2>
            <p className="text-muted text-sm">
              Turn off “Send emails” to pause every email {settings.appName} sends, for example while
              testing or before launch. Nothing is queued: emails skipped while paused are never sent
              later. Google Chat posts are not affected.
            </p>
          </div>
          <div
            className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${emailsEnabled ? "border-border" : "border-warning bg-warning/10"}`}
          >
            <div>
              <p className="text-sm font-medium">Send emails</p>
              <p className="text-muted text-xs">
                {emailsEnabled ? "On. The emails switched on below are sent." : "Off. No emails are sent at all."}
              </p>
            </div>
            <Switch checked={emailsEnabled} onCheckedChange={setEmailsEnabled} aria-label="Send emails" />
          </div>
          {EMAIL_KINDS.map(({ key, label, hint }) => (
            <div
              key={key}
              className={`border-border flex items-center justify-between gap-4 rounded-lg border p-3 ${emailsEnabled ? "" : "opacity-50"}`}
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-muted text-xs">{hint}</p>
              </div>
              <Switch
                checked={emails[key]}
                disabled={!emailsEnabled}
                onCheckedChange={(on) => setEmails((prev) => ({ ...prev, [key]: on }))}
                aria-label={label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="google-chat">
        <CardContent className="space-y-3">
          <div>
            <h2 className="font-semibold">Google Chat</h2>
            <p className="text-muted text-sm">
              {chatConnected
                ? "Connected. The events switched on below are posted to your Google Chat space."
                : "Not connected. Add the space's webhook as GOOGLE_CHAT_WEBHOOK_URL in Vercel (Production) and redeploy. Your choices below are kept until then."}
            </p>
          </div>
          {CHAT_EVENTS.map(({ key, label, hint }) => (
            <div key={key} className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-muted text-xs">{hint}</p>
              </div>
              <Switch
                checked={chat[key]}
                onCheckedChange={(on) => setChat((prev) => ({ ...prev, [key]: on }))}
                aria-label={label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
