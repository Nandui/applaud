"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateEconomySettings, type ActionResult } from "@/lib/economy-actions";
import {
  centsToEuros,
  economyForecast,
  parseEurosToCents,
  pointsToCents,
  type EconomyInputs,
} from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type EconomyFormData = EconomyInputs & {
  maxPointsPerShoutoutStaff: number;
  maxPointsPerShoutoutManager: number;
};

type Field = keyof EconomyFormData;

/**
 * Every economy setting in one form, with the money maths recalculated as you
 * type: what a point is worth, the worst-case month against the budget, and
 * what each allowance and limit means in euros.
 */
export function EconomyForm({
  settings,
  headcount,
}: {
  settings: EconomyFormData;
  headcount: { staff: number; managers: number };
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateEconomySettings,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  // Raw text per field so half-typed values don't jump around.
  const [raw, setRaw] = useState<Record<Field, string>>({
    pointsPerEuro: String(settings.pointsPerEuro),
    monthlyRewardBudgetCents: String(settings.monthlyRewardBudgetCents / 100),
    monthlyAllowanceStaff: String(settings.monthlyAllowanceStaff),
    monthlyAllowanceManager: String(settings.monthlyAllowanceManager),
    monthlyBonusPool: String(settings.monthlyBonusPool),
    maxPointsPerShoutoutStaff: String(settings.maxPointsPerShoutoutStaff),
    maxPointsPerShoutoutManager: String(settings.maxPointsPerShoutoutManager),
  });
  const num = (f: Field) => Math.max(0, Math.floor(Number(raw[f])) || 0);
  const rate = Math.max(1, num("pointsPerEuro"));
  const inputs: EconomyInputs = {
    pointsPerEuro: rate,
    monthlyRewardBudgetCents: parseEurosToCents(raw.monthlyRewardBudgetCents) ?? 0,
    monthlyAllowanceStaff: num("monthlyAllowanceStaff"),
    monthlyAllowanceManager: num("monthlyAllowanceManager"),
    monthlyBonusPool: num("monthlyBonusPool"),
  };
  const f = economyForecast(inputs, headcount);
  const euros = (points: number) => centsToEuros(pointsToCents(points, rate));
  const fits = f.overBudgetCents === 0;

  function field(name: Field, label: string, hint: string, opts: { euros?: boolean } = {}) {
    const formName = name === "monthlyRewardBudgetCents" ? "monthlyRewardBudget" : name;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={formName}>{label}</Label>
        <Input
          id={formName}
          name={formName}
          inputMode={opts.euros ? "decimal" : "numeric"}
          value={raw[name]}
          onChange={(e) => setRaw((r) => ({ ...r, [name]: e.target.value }))}
          className="font-mono"
        />
        <p className="text-muted text-xs">{hint}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {field(
              "pointsPerEuro",
              "Points per €1",
              `1 point = ${centsToEuros(pointsToCents(1, rate))}. 1,000 points = ${euros(1000)}. Staff only ever see points.`,
            )}
            {field(
              "monthlyRewardBudgetCents",
              "Rewards budget per month (€)",
              `For all staff together. Worth ${formatNumber(f.budgetPoints)} points. About ${centsToEuros(f.budgetPerPersonCents)} per person.`,
              { euros: true },
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Points to give each month</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {field(
              "monthlyAllowanceStaff",
              "Staff allowance",
              `${euros(inputs.monthlyAllowanceStaff)} each · ${formatNumber(headcount.staff)} people = ${formatNumber(f.staffPoints)} pts (${euros(f.staffPoints)})`,
            )}
            {field(
              "monthlyAllowanceManager",
              "Manager allowance",
              `${euros(inputs.monthlyAllowanceManager)} each · ${formatNumber(headcount.managers)} managers, admins, operations and CEO = ${formatNumber(f.managerPoints)} pts (${euros(f.managerPoints)})`,
            )}
            {field(
              "maxPointsPerShoutoutStaff",
              "Most per shout-out (staff)",
              `Per person, ${euros(num("maxPointsPerShoutoutStaff"))}. 0 = no limit.`,
            )}
            {field(
              "maxPointsPerShoutoutManager",
              "Most per shout-out (managers)",
              `Per person, ${euros(num("maxPointsPerShoutoutManager"))}. 0 = no limit.`,
            )}
            <p className="text-muted text-xs sm:col-span-2">
              Unused points to give disappear at midnight on the 1st, Irish time. Wallets (points
              people received) never expire.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bonus pool</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {field(
              "monthlyBonusPool",
              "Bonus points per month",
              `${euros(inputs.monthlyBonusPool)}. Pays for CEO and Operations boosts, approved awards (e.g. Employee of the Month) and milestones. Instant awards come from the giver's own allowance instead.`,
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save economy"}
          </Button>
        </div>
      </div>

      <Card className="h-fit 2xl:sticky 2xl:top-4">
        <CardHeader>
          <CardTitle>Worst-case month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted">
            If everyone gave every point and every point were spent on rewards with a cash cost.
          </p>
          <dl className="space-y-1.5">
            <Line label="Staff allowances" value={`${formatNumber(f.staffPoints)} pts`} sub={euros(f.staffPoints)} />
            <Line label="Manager allowances" value={`${formatNumber(f.managerPoints)} pts`} sub={euros(f.managerPoints)} />
            <Line label="Bonus pool" value={`${formatNumber(f.bonusPoints)} pts`} sub={euros(f.bonusPoints)} />
            <div className="border-border border-t pt-1.5">
              <Line label="Most points a month" value={`${formatNumber(f.maxPoints)} pts`} sub={centsToEuros(f.maxCents)} strong />
            </div>
            <Line label="Typical (about half given)" value={centsToEuros(f.typicalCents)} />
            <Line label="Rewards budget" value={centsToEuros(inputs.monthlyRewardBudgetCents)} />
          </dl>
          <div
            className={cn(
              "rounded-lg p-3 text-[0.85rem] leading-snug",
              fits ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
            )}
          >
            {fits
              ? `Fits. Even the worst case is ${centsToEuros(inputs.monthlyRewardBudgetCents - f.maxCents)} under budget.`
              : `The worst case is ${centsToEuros(f.overBudgetCents)} over budget. The monthly cap still stops claims at ${centsToEuros(inputs.monthlyRewardBudgetCents)}, but more people will see "back on the 1st". Lower allowances or raise the budget to fit.`}
          </div>
          <p className="text-muted text-xs">
            Profile Store items cost the company nothing, and points can sit in wallets across
            months, so the monthly cap on reward claims is what guarantees the budget.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

function Line({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd data-numeric className={cn("text-right", strong ? "font-bold" : "font-medium")}>
        {value}
        {sub ? <span className="text-muted ml-1.5 text-xs font-normal">{sub}</span> : null}
      </dd>
    </div>
  );
}
