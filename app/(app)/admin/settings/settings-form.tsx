"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateOrgSettings, type ActionResult } from "@/lib/settings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type SettingsData = {
  appName: string;
  monthlyAllowanceStaff: number;
  monthlyAllowanceManager: number;
  pointsExpiryMonths: number | null;
  allowSelfRecognition: boolean;
};

export function SettingsForm({ settings }: { settings: SettingsData }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateOrgSettings, undefined);
  const [allowSelf, setAllowSelf] = useState(settings.allowSelfRecognition);

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="allowSelfRecognition" value={String(allowSelf)} />

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appName">App name</Label>
            <Input id="appName" name="appName" defaultValue={settings.appName} required />
            <p className="text-muted text-xs">Shown in the UI and emails.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthlyAllowanceStaff">Staff allowance / month</Label>
              <Input
                id="monthlyAllowanceStaff"
                name="monthlyAllowanceStaff"
                type="number"
                min={0}
                defaultValue={settings.monthlyAllowanceStaff}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthlyAllowanceManager">Manager allowance / month</Label>
              <Input
                id="monthlyAllowanceManager"
                name="monthlyAllowanceManager"
                type="number"
                min={0}
                defaultValue={settings.monthlyAllowanceManager}
                className="font-mono"
              />
            </div>
          </div>
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
