import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLeaderboard, PERIODS, PERIOD_LABELS, type Period } from "@/lib/leaderboard";
import { daysLeft } from "@/lib/periods";
import { formatNumber, pts } from "@/lib/format";
import { AppBar } from "@/components/app-shell/app-bar";
import {
  BoardSwitch,
  LeaderboardFilters,
  type Board,
} from "@/components/leaderboard/filters";
import { RankedList } from "@/components/leaderboard/ranked-list";
import { RanksTabs } from "@/components/ranks/ranks-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ranks" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; period?: string; board?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;

  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? "")
    ? (sp.period as Period)
    : "month";
  const siteId = sp.site && sp.site !== "all" ? sp.site : undefined;
  const board: Board = sp.board === "given" ? "given" : "received";

  const [sites, data] = await Promise.all([
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Fetch deep enough to find the viewer's own rank, not just the top few.
    getLeaderboard({ siteId, period, take: 200 }),
  ]);

  const rows =
    board === "received"
      ? data.receivers.map((r) => ({
          id: r.id,
          name: r.name,
          avatarUrl: r.avatarUrl,
          frame: r.frame,
          subtitle: [r.jobTitle, r.siteCode].filter(Boolean).join(" · "),
          primary: pts(r.points),
          secondary: `${formatNumber(r.count)} received`,
        }))
      : data.givers.map((g) => ({
          id: g.id,
          name: g.name,
          avatarUrl: g.avatarUrl,
          frame: g.frame,
          subtitle: [g.jobTitle, g.siteCode].filter(Boolean).join(" · "),
          primary: `${formatNumber(g.count)} sent`,
          secondary: `${pts(g.pointsGiven)} given`,
        }));
  const left = daysLeft(period);

  return (
    <div className="mx-auto max-w-xl">
      <AppBar title="Ranks" tabs={<RanksTabs active="leaderboard" />} />

      <div className="space-y-3 pt-3">
        <BoardSwitch board={board} />
        <LeaderboardFilters sites={sites} site={siteId ?? "all"} period={period} />
        <p className="text-muted pt-1 text-[0.82rem]">
          {PERIOD_LABELS[period]}
          {left !== null && ` · ${left} ${left === 1 ? "day" : "days"} left`}
        </p>
        <RankedList rows={rows} viewerId={me.id} />
      </div>
    </div>
  );
}
