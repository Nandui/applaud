import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLeaderboard, PERIODS, type Period } from "@/lib/leaderboard";
import { formatNumber, pts } from "@/lib/format";
import { AppBar } from "@/components/app-shell/app-bar";
import {
  BoardSwitch,
  LeaderboardFilters,
  type Board,
} from "@/components/leaderboard/filters";
import { RankedList } from "@/components/leaderboard/ranked-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

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
    getLeaderboard({ siteId, period }),
  ]);

  const rows =
    board === "received"
      ? data.receivers.map((r) => ({
          id: r.id,
          name: r.name,
          avatarUrl: r.avatarUrl,
          subtitle: `${r.jobTitle ?? "—"} · ${r.siteCode}`,
          primary: pts(r.points),
          secondary: `${formatNumber(r.count)} received`,
        }))
      : data.givers.map((g) => ({
          id: g.id,
          name: g.name,
          avatarUrl: g.avatarUrl,
          subtitle: `${g.jobTitle ?? "—"} · ${g.siteCode}`,
          primary: `${formatNumber(g.count)} given`,
          secondary: `${pts(g.pointsGiven)} awarded`,
        }));

  const filters = (
    <LeaderboardFilters sites={sites} site={siteId ?? "all"} period={period} />
  );

  return (
    <div className="mx-auto max-w-xl">
      <AppBar title="Leaderboard">
        <BoardSwitch board={board} />
      </AppBar>
      <div className="hidden space-y-4 pb-2 md:block">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <BoardSwitch board={board} />
      </div>
      {filters}
      <RankedList rows={rows} viewerId={me.id} />
    </div>
  );
}
