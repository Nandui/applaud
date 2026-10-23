import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getEconomyStatus, getMonthlyClaimCounts } from "@/lib/budget";
import { centsToEuros, pointsToCents } from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { BudgetCard } from "@/components/admin/budget-card";
import { EconomyForm } from "@/components/admin/economy-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Economy" };

/**
 * The points economy in one place: the euro conversion, budget, allowances and
 * limits (with live maths) and how each reward fits the monthly budget.
 * Profile Store prices live in Admin > Store.
 */
export default async function AdminEconomyPage() {
  await requireAdmin();
  const settings = await getOrgSettings();

  const [people, rewards, claims, status] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: { active: true, siteId: { not: null } },
    }),
    prisma.reward.findMany({
      // Standing discounts cost nothing and are never claimed.
      where: { active: true, kind: "reward" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, pointsCost: true, euroCostCents: true, monthlyStock: true },
    }),
    getMonthlyClaimCounts(),
    getEconomyStatus(settings),
  ]);

  const staff = people.find((p) => p.role === "staff")?._count._all ?? 0;
  const managers = people.filter((p) => p.role !== "staff").reduce((n, p) => n + p._count._all, 0);
  const rate = settings.pointsPerEuro;
  const budget = settings.monthlyRewardBudgetCents;

  const rows = rewards.map((r) => {
    const faceCents = pointsToCents(r.pointsCost, rate);
    const maxMonthCents = r.monthlyStock === null ? null : r.monthlyStock * r.euroCostCents;
    return {
      ...r,
      faceCents,
      maxMonthCents,
      claimed: claims.get(r.id) ?? 0,
      // Staff pay fewer points than the item costs in cash: generous, but it
      // stretches the budget.
      underpriced: r.euroCostCents > faceCents,
      unlimitedCash: r.monthlyStock === null && r.euroCostCents > 0,
    };
  });
  const limitedTotal = rows.reduce((sum, r) => sum + (r.maxMonthCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Economy"
        description="What a point is worth, the monthly budget, allowances and prices. Changes apply straight away."
      />

      <BudgetCard status={status} />

      <EconomyForm
        settings={{
          pointsPerEuro: settings.pointsPerEuro,
          monthlyRewardBudgetCents: settings.monthlyRewardBudgetCents,
          monthlyAllowanceStaff: settings.monthlyAllowanceStaff,
          monthlyAllowanceManager: settings.monthlyAllowanceManager,
          monthlyBonusPool: settings.monthlyBonusPool,
          maxPointsPerShoutoutStaff: settings.maxPointsPerShoutoutStaff,
          maxPointsPerShoutoutManager: settings.maxPointsPerShoutoutManager,
        }}
        headcount={{ staff, managers }}
      />

      <Card>
        <CardHeader>
          <CardTitle>How rewards fit the budget</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted mb-4 text-sm">
            Face value is what the points are worth at {formatNumber(rate)} points per €1. Cash cost
            is what you actually pay. &ldquo;Most per month&rdquo; is the monthly stock times the cash
            cost. Edit prices, cash costs and stock in{" "}
            <Link href="/admin/rewards" className="text-primary font-medium">
              Rewards
            </Link>
            .
          </p>
          {rows.length === 0 ? (
            <p className="text-muted text-sm">
              No rewards yet. Use &ldquo;Load suggested rewards&rdquo; in{" "}
              <Link href="/admin/rewards" className="text-primary font-medium">
                Rewards
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="text-muted text-left text-xs">
                    <th className="py-2 font-medium">Reward</th>
                    <th className="py-2 text-right font-medium">Points</th>
                    <th className="py-2 text-right font-medium">Face value</th>
                    <th className="py-2 text-right font-medium">Cash cost</th>
                    <th className="py-2 text-right font-medium">Stock / month</th>
                    <th className="py-2 text-right font-medium">Most per month</th>
                    <th className="py-2 text-right font-medium">Of budget</th>
                    <th className="py-2 text-right font-medium">Claimed</th>
                  </tr>
                </thead>
                <tbody data-numeric>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-border border-t">
                      <td className="py-2">
                        {r.name}
                        {r.underpriced ? (
                          <span className="text-warning block text-xs">Costs more cash than its points are worth</span>
                        ) : null}
                        {r.unlimitedCash ? (
                          <span className="text-warning block text-xs">No monthly stock: only the budget limits it</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">{formatNumber(r.pointsCost)}</td>
                      <td className="text-muted py-2 text-right">{centsToEuros(r.faceCents)}</td>
                      <td className="py-2 text-right">{r.euroCostCents === 0 ? "€0 perk" : centsToEuros(r.euroCostCents)}</td>
                      <td className="py-2 text-right">{r.monthlyStock ?? "∞"}</td>
                      <td className="py-2 text-right">{r.maxMonthCents === null ? "∞" : centsToEuros(r.maxMonthCents)}</td>
                      <td className={cn("py-2 text-right", r.maxMonthCents !== null && budget > 0 && r.maxMonthCents > budget / 2 && "text-warning font-semibold")}>
                        {r.maxMonthCents === null || budget === 0 ? "—" : `${Math.round((r.maxMonthCents / budget) * 100)}%`}
                      </td>
                      <td className="py-2 text-right">
                        {r.claimed}
                        {r.monthlyStock !== null ? <span className="text-muted"> / {r.monthlyStock}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-border border-t font-semibold">
                    <td className="py-2" colSpan={5}>
                      If every limited reward sold out
                    </td>
                    <td data-numeric className="py-2 text-right">{centsToEuros(limitedTotal)}</td>
                    <td data-numeric className="py-2 text-right">
                      {budget > 0 ? `${Math.round((limitedTotal / budget) * 100)}%` : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-muted mt-3 text-xs">
            Above 100% is fine: the monthly budget stops claims once {centsToEuros(budget)} is
            reached, and stock stops any one reward taking it all.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted text-sm">
        Profile frames, banners and themes are priced in{" "}
        <Link href="/admin/store" className="text-primary font-medium">
          Admin &gt; Store
        </Link>
        .
      </p>
    </div>
  );
}
