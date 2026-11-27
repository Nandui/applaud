import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AppBar } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { TabLinks } from "@/components/tab-links";
import { IdeasBoard, type IdeaData } from "@/components/ideas/ideas-board";
import { KIND_TEXT, isSuggestionKind, itemPath, type SuggestionKind, type SuggestionStatus } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ideas" };

/**
 * Staff ideas for future rewards and profile shop items. Everyone can post
 * one and upvote others; the most wanted rise to the top. Admins approve
 * them (Coming soon), decline them (Not planned) or, once added, link them
 * to the reward or item (Available) in Admin > Suggestions.
 */
export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const kind: SuggestionKind = isSuggestionKind(k) ? k : "reward";
  const me = await requireUser();

  const rows = await prisma.suggestion.findMany({
    where: { kind },
    orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      details: true,
      status: true,
      adminNote: true,
      voteCount: true,
      createdAt: true,
      rewardId: true,
      cosmeticId: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
      votes: { where: { userId: me.id }, select: { userId: true } },
    },
  });

  // Available ideas link to what they became, while it's still on show.
  const ids = rows.filter((r) => r.status === "added").map((r) => (kind === "shop" ? r.cosmeticId : r.rewardId)).filter((id): id is string => !!id);
  const live = ids.length === 0
    ? []
    : kind === "shop"
      ? await prisma.cosmetic.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true } })
      : await prisma.reward.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true } });
  const itemName = new Map(live.map((i) => [i.id, i.name]));
  const itemOf = (id: string | null) => (id && itemName.has(id) ? { name: itemName.get(id)!, href: itemPath(kind, id) } : null);

  const ideas: IdeaData[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    details: r.details,
    status: r.status as SuggestionStatus,
    adminNote: r.adminNote,
    votes: r.voteCount,
    voted: r.votes.length > 0,
    createdAt: r.createdAt.toISOString(),
    mine: r.user.id === me.id,
    author: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
    item: r.status === "added" ? itemOf(kind === "shop" ? r.cosmeticId : r.rewardId) : null,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <AppBar
        title="Ideas"
        leading={<BackButton fallback={kind === "shop" ? "/shop" : "/rewards"} />}
        tabs={
          <TabLinks
            active={kind}
            tabs={(["reward", "shop"] as const).map((key) => ({
              key,
              label: KIND_TEXT[key].tab,
              href: `/rewards/ideas?k=${key}`,
            }))}
          />
        }
      />
      <IdeasBoard key={kind} kind={kind} ideas={ideas} />
    </div>
  );
}
