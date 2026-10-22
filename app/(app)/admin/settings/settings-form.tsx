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
  pointsExpiryMonths: number | null;
  allowSelfRecognition: boolean;
  autoCreateGoogleUsers: boolean;
};

export function SettingsForm({ settings }: { settings: SettingsData }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateOrgSettings, undefined);
  const [allowSelf, setAllowSelf] = useState(settings.allowSelfRecognition);
  const [autoCreate, setAutoCreate] = useState(settings.autoCreateGoogleUsers);

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="allowSelfRecognition" value={String(allowSelf)} />
      <input type="hidden" name="autoCreateGoogleUsers" value={String(autoCreate)} />

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appName">App name</Label>
            <Input id="appName" name="appName" defaultValue={settings.appName} required />
            <p className="text-muted text-xs">Shown in the UI and emails.</p>
          </div>
          <p className="text-muted text-sm">
            Points, allowances, the euro conversion and the rewards budget live in{" "}
            <Link href="/admin/economy" className="text-primary font-medium">
              Economy
            </Link>
            .
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pointsExpiryMonths">Points expiry (months)</Label>
            <Input
              id="pointsExpiryMonths"
              name="pointsExpiryMonths"
              type="number"
              min={1}
              defaultValue={settings.pointsExpiryMonths ?? ""}
              placeholder="Never"
              className="font-mono"
            />
            <p className="text-muted text-xs">Leave blank for points that never expire.</p>
          </div>
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

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
