"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { updateOrgSettings, type ActionResult } from "@/lib/settings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sendSampleEmails } from "@/lib/email/actions";

export type SettingsData = {
  appName: string;
  allowSelfRecognition: boolean;
  autoCreateGoogleUsers: boolean;
  emailRecipients: boolean;
  emailEveryone: boolean;
  emailTestMode: boolean;
  emailTestAddress: string;
};

export function SettingsForm({
  settings,
  emailReady,
}: {
  settings: SettingsData;
  emailReady: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateOrgSettings, undefined);
  const [allowSelf, setAllowSelf] = useState(settings.allowSelfRecognition);
  const [autoCreate, setAutoCreate] = useState(settings.autoCreateGoogleUsers);
  const [emailRecipients, setEmailRecipients] = useState(settings.emailRecipients);
  const [emailEveryone, setEmailEveryone] = useState(settings.emailEveryone);
  const [testMode, setTestMode] = useState(settings.emailTestMode);
  const [sending, startSending] = useTransition();

  function sendSamples() {
    startSending(async () => {
      const result = await sendSampleEmails();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="allowSelfRecognition" value={String(allowSelf)} />
      <input type="hidden" name="autoCreateGoogleUsers" value={String(autoCreate)} />
      <input type="hidden" name="emailRecipients" value={String(emailRecipients)} />
      <input type="hidden" name="emailEveryone" value={String(emailEveryone)} />
      <input type="hidden" name="emailTestMode" value={String(testMode)} />

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

      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="font-semibold">Emails</p>
            <p className="text-muted text-xs">
              {emailReady
                ? "Sent when someone is recognised or thanked for covering."
                : "The email service isn't connected yet, so nothing is sent. Add the Google Workspace (or SMTP) settings in Vercel to switch it on."}
            </p>
          </div>
          <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Email the person who&apos;s recognised</p>
              <p className="text-muted text-xs">
                A celebratory email with the message, the value and their points.
              </p>
            </div>
            <Switch checked={emailRecipients} onCheckedChange={setEmailRecipients} />
          </div>
          <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Email everyone else</p>
              <p className="text-muted text-xs">
                Says someone was recognised without saying who, and asks them to sign in,
                see who got it and react or comment.
              </p>
            </div>
            <Switch checked={emailEveryone} onCheckedChange={setEmailEveryone} />
          </div>
          <div className="border-border space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Test mode</p>
                <p className="text-muted text-xs">
                  Every email goes only to the address below, marked with who it would
                  have gone to. Turn off to email staff for real.
                </p>
              </div>
              <Switch checked={testMode} onCheckedChange={setTestMode} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailTestAddress">Test address</Label>
              <Input
                id="emailTestAddress"
                name="emailTestAddress"
                type="email"
                defaultValue={settings.emailTestAddress}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sending || !emailReady}
              onClick={sendSamples}
            >
              {sending ? "Sending…" : "Send me both emails"}
            </Button>
          </div>
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
