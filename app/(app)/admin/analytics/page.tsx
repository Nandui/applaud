import Link from "next/link";
import { Activity, Award, MessageSquare, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getAnalytics } from "@/lib/analytics";
import { PERIODS, PERIOD_LABELS, type Period } from "@/lib/periods";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { LeaderboardFilters } from "@/components/leaderboard/filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VolumeLineChart,
  CategoryBarChart,
  ValuePieChart,
} from "@/components/analytics/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? "")
    ? (sp.period as Period)
    : "month";
  const siteId = sp.site && sp.site !== "all" ? sp.site : undefined;

  const [sites, a] = await Promise.all([
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getAnalytics({ siteId, period }),
  ]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Adoption and recognition activity."
        action={
          <LeaderboardFilters
            sites={sites}
            site={siteId ?? "all"}
            period={period}
          />
        }
      />

      {/* Headline + stats */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="from-primary/10 to-accent/10 border-primary/20 bg-gradient-to-br lg:col-span-2">
          <CardContent className="space-y-1">
            <div className="text-muted flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4" /> Participation rate
              <span className="text-muted/80">· {PERIOD_LABELS[period]}</span>
            </div>
            <p data-numeric className="text-5xl font-semibold tracking-tight">
              {a.participationRate}%
            </p>
            <p className="text-muted text-sm">
              <span data-numeric>{a.participatingUsers}</span> of{" "}
              <span data-numeric>{a.activeUsers}</span> active people gave or
              received recognition
            </p>
          </CardContent>
        </Card>

        <StatCard
          icon={<MessageSquare className="size-4" />}
          value={formatNumber(a.totalRecognitions)}
          label="recognitions"
        />
        <StatCard
          icon={<Award className="size-4" />}
          value={formatNumber(a.totalPoints)}
          label="points awarded"
        />
      </div>

      {/* Volume */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recognition volume</CardTitle>
        </CardHeader>
        <CardContent>
          <VolumeLineChart data={a.volume} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By site</CardTitle>
          </CardHeader>
          <CardContent>
            {a.bySite.length ? (
              <CategoryBarChart data={a.bySite} />
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value usage</CardTitle>
          </CardHeader>
          <CardContent>
            {a.valueUsage.length ? <ValuePieChart data={a.valueUsage} /> : <Empty />}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top receivers</CardTitle>
          </CardHeader>
          <CardContent>
            <RankRows
              rows={a.topReceivers.map((r) => ({
                id: r.id,
                name: r.name,
                value: `${formatNumber(r.points)} pts`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top givers</CardTitle>
          </CardHeader>
          <CardContent>
            <RankRows
              rows={a.topGivers.map((g) => ({
                id: g.id,
                name: g.name,
                value: `${formatNumber(g.count)}`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time to first recognition</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col justify-center">
            <div className="flex items-center gap-2">
              <Clock className="text-accent size-5" />
              <p data-numeric className="text-3xl font-semibold">
                {a.medianTimeToFirstDays ?? "—"}
                {a.medianTimeToFirstDays !== null && (
                  <span className="text-muted ml-1 text-base font-normal">days</span>
                )}
              </p>
            </div>
            <p className="text-muted mt-1 text-xs">
              Median for {a.newHireSample} new hire
              {a.newHireSample === 1 ? "" : "s"} (last 18 months)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <span className="text-muted flex items-center gap-2 text-sm font-medium">
          {icon} {label}
        </span>
        <p data-numeric className="text-3xl font-semibold tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function RankRows({
  rows,
}: {
  rows: { id: string; name: string; value: string }[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <ol className="divide-border divide-y">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
          <span data-numeric className="text-muted w-4 text-xs">
            {i + 1}
          </span>
          <Link
            href={`/profile/${r.id}`}
            className="hover:text-primary flex-1 truncate font-medium"
          >
            {r.name}
          </Link>
          <span data-numeric className="font-semibold">
            {r.value}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Empty() {
  return (
    <p className="text-muted py-12 text-center text-sm">No data for this period.</p>
  );
}
