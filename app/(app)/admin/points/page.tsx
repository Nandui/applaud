import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { getPointsMonth, monthKey, monthRef, shiftMonth } from "@/lib/points-analytics";
import { centsToEuros, ECONOMY_TIMEZONE, pointsToCents, resetsInLabel } from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBarChart } from "@/components/analytics/charts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Points this month" };

/**
 * Points analytics for one month (Irish time): giving allowances used and
 * still to use, where received points went, the bonus pool, and the cash
 * claimed against the rewards budget.
 */
export default async function AdminPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const { month: monthParam } = await searchParams;
  const settings = await getOrgSettings();
  const ref = monthRef(monthParam);
  const key = monthKey(ref);
  const currentKey = monthKey();
  const isCurrent = key === currentKey;
  const isFuture = key > currentKey;
  const d = await getPointsMonth(settings, isCurrent ? new Date() : ref);
  const euros = (points: number) => centsToEuros(pointsToCents(points, d.rate));
  const label = new Intl.DateTimeFormat("en-IE", { timeZone: ECONOMY_TIMEZONE, month: "long", year: "numeric" }).format(ref);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const idle = d.people.filter((p) => p.given === 0 && p.allowance > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Points · ${label}`}
        description={
          isCurrent
            ? `Live. Unused points to give disappear when the month ${resetsInLabel()}.`
            : "A past month. Points to give that weren't used have expired."
        }
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/points?month=${shiftMonth(key, -1)}`}
              aria-label="Previous month"
              className="bg-secondary inline-flex size-9 items-center justify-center rounded-md"
            >
              <ChevronLeft className="size-4" />
            </Link>
            {!isCurrent ? (
              <Link href="/admin/points" className="bg-secondary inline-flex h-9 items-center rounded-md px-3 text-sm font-medium">
                This month
              </Link>
            ) : null}
            {!isCurrent && !isFuture ? (
              <Link
                href={`/admin/points?month=${shiftMonth(key, 1)}`}
                aria-label="Next month"
                className="bg-secondary inline-flex size-9 items-center justify-center rounded-md"
              >
                <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <Stat
          label="Points to give"
          value={formatNumber(d.totalAllowance)}
          sub={`${formatNumber(d.people.length)} people · ${euros(d.totalAllowance)}`}
        />
        <Stat
          label="Given"
          value={formatNumber(d.given)}
          sub={`${pct(d.given, d.totalAllowance)}% of allowances · ${euros(d.given)}`}
          meter={pct(d.given, d.totalAllowance)}
        />
        <Stat
          label={isCurrent ? "Still to give" : "Expired unused"}
          value={formatNumber(d.left)}
          sub={isCurrent ? `Gone ${resetsInLabel().replace("resets ", "")} if unused` : "Never cost anything"}
        />
        <Stat
          label="People giving"
          value={`${formatNumber(d.givers)} / ${formatNumber(d.people.length)}`}
          sub={`${pct(d.givers, d.people.length)}% have sent points`}
          meter={pct(d.givers, d.people.length)}
        />
        <Stat label="Received into wallets" value={formatNumber(d.received)} sub={`Shout-outs, awards and boosts · ${euros(d.received)}`} />
        <Stat label="Spent in the Store" value={formatNumber(d.spentStore)} sub="Profile items, €0 to you" />
        <Stat label="Spent on rewards" value={formatNumber(d.spentRewards)} sub={(() => { const n = d.claims.reduce((s, c) => s + c.count, 0); return `${formatNumber(n)} ${n === 1 ? "claim" : "claims"}`; })()} />
        <Stat
          label="Cash claimed"
          value={centsToEuros(d.cashCents)}
          sub={`of ${centsToEuros(d.budgetCents)} budget · ${centsToEuros(Math.max(0, d.budgetCents - d.cashCents))} left`}
          meter={pct(d.cashCents, d.budgetCents)}
        />
        <Stat
          label="Bonus pool used"
          value={`${formatNumber(d.bonusUsed)} / ${formatNumber(d.bonusPool)}`}
          sub="Boosts, approved awards and milestones"
          meter={pct(d.bonusUsed, d.bonusPool)}
        />
        <Stat label="Points in wallets now" value={formatNumber(d.walletPoints)} sub={`${euros(d.walletPoints)} if all spent on rewards`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Points given per day</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBarChart data={d.daily} name="Points given" color="#6a4dff" yWidth={48} />
        </CardContent>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reward claims</CardTitle>
          </CardHeader>
          <CardContent>
            {d.claims.length === 0 ? (
              <p className="text-muted text-sm">No rewards claimed this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[22rem] text-sm">
                  <thead>
                    <tr className="text-muted text-left text-xs">
                      <th className="py-1.5 font-medium">Reward</th>
                      <th className="py-1.5 text-right font-medium">Claims</th>
                      <th className="py-1.5 text-right font-medium">Points</th>
                      <th className="py-1.5 text-right font-medium">Cash</th>
                    </tr>
                  </thead>
                  <tbody data-numeric>
                    {d.claims.map((c) => (
                      <tr key={c.name} className="border-border border-t">
                        <td className="py-1.5">{c.name}</td>
                        <td className="py-1.5 text-right">
                          {c.count}
                          {c.monthlyStock !== null ? <span className="text-muted"> / {c.monthlyStock}</span> : null}
                        </td>
                        <td className="py-1.5 text-right">{formatNumber(c.points)}</td>
                        <td className="py-1.5 text-right">{centsToEuros(c.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who&apos;s giving</CardTitle>
          </CardHeader>
          <CardContent>
            {idle.length > 0 ? (
              <p className="text-muted mb-3 text-sm">
                {formatNumber(idle.length)} {idle.length === 1 ? "person hasn't" : "people haven't"} given any
                points {isCurrent ? "yet" : "this month"}.
              </p>
            ) : null}
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead className="bg-card sticky top-0">
                  <tr className="text-muted text-left text-xs">
                    <th className="py-1.5 font-medium">Person</th>
                    <th className="py-1.5 text-right font-medium">Given</th>
                    <th className="py-1.5 text-right font-medium">{isCurrent ? "Left" : "Unused"}</th>
                    <th className="py-1.5 text-right font-medium">Wallet</th>
                  </tr>
                </thead>
                <tbody data-numeric>
                  {d.people.map((p) => (
                    <tr key={p.id} className="border-border border-t">
                      <td className="py-1.5">
                        <Link href={`/profile/${p.id}`} className="font-medium">
                          {p.name}
                        </Link>
                        <span className="text-muted block text-xs">{p.jobTitle ?? p.role}</span>
                      </td>
                      <td className={cn("py-1.5 text-right", p.given === 0 && "text-muted")}>
                        {formatNumber(p.given)}
                        <span className="text-muted"> / {formatNumber(p.allowance)}</span>
                      </td>
                      <td className="py-1.5 text-right">{formatNumber(p.left)}</td>
                      <td className="py-1.5 text-right">{formatNumber(p.walletBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, meter }: { label: string; value: string; sub: string; meter?: number }) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <p className="text-muted text-sm">{label}</p>
        <p data-numeric className="text-2xl font-semibold">
          {value}
        </p>
        {meter !== undefined ? (
          <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full", meter >= 90 ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.min(100, meter)}%` }}
            />
          </div>
        ) : null}
        <p className="text-muted text-xs">{sub}</p>
      </CardContent>
    </Card>
  );
}
