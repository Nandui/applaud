import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLeaderboard, PERIODS, type Period } from "@/lib/leaderboard";
import { formatNumber, pts } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { LeaderboardFilters } from "@/components/leaderboard/filters";
import { RankedList } from "@/components/leaderboard/ranked-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; period?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? "")
    ? (sp.period as Period)
    : "month";
  const siteId = sp.site && sp.site !== "all" ? sp.site : undefined;

  const [sites, board] = await Promise.all([
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getLeaderboard({ siteId, period }),
  ]);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description="Top recognised and top givers across the team."
        action={
          <LeaderboardFilters
            sites={sites}
            site={siteId ?? "all"}
            period={period}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <RankedList
          title="Top recognised"
          subtitle="By points received"
          rows={board.receivers.map((r) => ({
            id: r.id,
            name: r.name,
            avatarUrl: r.avatarUrl,
            subtitle: `${r.jobTitle ?? "—"} · ${r.siteCode}`,
            primary: pts(r.points),
            secondary: `${formatNumber(r.count)} received`,
          }))}
        />
        <RankedList
          title="Top givers"
          subtitle="By recognitions given"
          rows={board.givers.map((g) => ({
            id: g.id,
            name: g.name,
            avatarUrl: g.avatarUrl,
            subtitle: `${g.jobTitle ?? "—"} · ${g.siteCode}`,
            primary: `${formatNumber(g.count)} given`,
            secondary: `${pts(g.pointsGiven)} awarded`,
          }))}
        />
      </div>
    </div>
  );
}
