import { Card, CardContent } from "@/components/ui/card";
import { centsToEuros } from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import type { EconomyStatus } from "@/lib/budget";
import { cn } from "@/lib/utils";

/** This month's rewards budget, bonus pool and wallet liability, for admins. */
export function BudgetCard({ status }: { status: EconomyStatus }) {
  const pct = status.budgetCents > 0 ? Math.min(100, (status.spentCents / status.budgetCents) * 100) : 100;
  const bonusPct = status.bonusPool > 0 ? Math.min(100, (status.bonusUsed / status.bonusPool) * 100) : 100;
  return (
    <Card>
      <CardContent className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="text-muted text-sm">Rewards budget this month</p>
          <p data-numeric className="text-2xl font-semibold">
            {centsToEuros(status.spentCents)}
            <span className="text-muted text-base font-normal"> of {centsToEuros(status.budgetCents)}</span>
          </p>
          <Meter pct={pct} />
          <p className="text-muted text-xs">
            {formatNumber(status.claims)} claims · {centsToEuros(status.leftCents)} left · resets {status.resetsOn}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-muted text-sm">Bonus pool (boosts and awards)</p>
          <p data-numeric className="text-2xl font-semibold">
            {formatNumber(status.bonusUsed)}
            <span className="text-muted text-base font-normal"> of {formatNumber(status.bonusPool)} pts</span>
          </p>
          <Meter pct={bonusPct} />
        </div>
        <div className="space-y-2">
          <p className="text-muted text-sm">Points in wallets</p>
          <p data-numeric className="text-2xl font-semibold">{formatNumber(status.walletPoints)}</p>
          <p className="text-muted text-xs">
            Worth {centsToEuros(status.walletCents)} if all spent on
            rewards. The monthly budget caps what can be claimed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Meter({ pct }: { pct: number }) {
  return (
    <div className="bg-secondary h-2 overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full", pct >= 90 ? "bg-warning" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
