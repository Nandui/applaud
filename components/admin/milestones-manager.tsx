"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarHeart, Cake, UserPlus, Play } from "lucide-react";
import {
  updateMilestoneRule,
  runMilestonesNow,
  type ActionResult,
} from "@/lib/milestones/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type RuleRow = {
  id: string;
  type: string;
  points: number;
  active: boolean;
  config: Record<string, unknown>;
};

const TYPE_META: Record<
  string,
  { label: string; icon: typeof CalendarHeart; hint: string }
> = {
  work_anniversary: {
    label: "Work anniversary",
    icon: CalendarHeart,
    hint: "Celebrated on the hire-date anniversary for the years below.",
  },
  birthday: { label: "Birthday", icon: Cake, hint: "Celebrated each year on the birthday." },
  onboarding: {
    label: "Onboarding",
    icon: UserPlus,
    hint: "Celebrated this many days after the hire date.",
  },
};

function RuleForm({ rule }: { rule: RuleRow }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateMilestoneRule, undefined);
  const [active, setActive] = useState(rule.active);

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  const meta = TYPE_META[rule.type] ?? {
    label: rule.type,
    icon: CalendarHeart,
    hint: "",
  };
  const Icon = meta.icon;
  const years = Array.isArray(rule.config.years)
    ? (rule.config.years as number[]).join(", ")
    : "";
  const dayOffset = Number(rule.config.dayOffset ?? 30);

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="type" value={rule.type} />
          <input type="hidden" name="active" value={String(active)} />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="bg-accent/10 text-accent flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-4.5" />
              </span>
              <div>
                <h3 className="font-display font-semibold">{meta.label}</h3>
                <p className="text-muted text-xs">{meta.hint}</p>
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`points-${rule.id}`}>Points</Label>
              <Input
                id={`points-${rule.id}`}
                name="points"
                type="number"
                min={0}
                defaultValue={rule.points}
                className="font-mono"
              />
            </div>
            {rule.type === "work_anniversary" && (
              <div className="space-y-1.5">
                <Label htmlFor={`years-${rule.id}`}>Years</Label>
                <Input
                  id={`years-${rule.id}`}
                  name="years"
                  defaultValue={years}
                  placeholder="1, 3, 5, 10"
                />
              </div>
            )}
            {rule.type === "onboarding" && (
              <div className="space-y-1.5">
                <Label htmlFor={`dayOffset-${rule.id}`}>Day offset</Label>
                <Input
                  id={`dayOffset-${rule.id}`}
                  name="dayOffset"
                  type="number"
                  min={0}
                  defaultValue={dayOffset}
                  className="font-mono"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MilestonesManager({ rules }: { rules: RuleRow[] }) {
  const [pending, start] = useTransition();

  function runNow() {
    start(async () => {
      const res = await runMilestonesNow();
      if (res.ok) toast.success(res.message ?? "Done.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={runNow} disabled={pending}>
          <Play className="size-4" /> {pending ? "Running…" : "Run milestones now"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rules.map((rule) => (
          <RuleForm key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
}
