import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { SuggestionsManager, type SuggestionRow } from "@/components/admin/suggestions-manager";
import type { SuggestionKind, SuggestionStatus } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suggestions" };

export default async function AdminSuggestionsPage() {
  await requireAdmin();

  const suggestions = await prisma.suggestion.findMany({
    orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, name: true } } },
  });

  const rows: SuggestionRow[] = suggestions.map((s) => ({
    id: s.id,
    kind: s.kind as SuggestionKind,
    title: s.title,
    details: s.details,
    status: s.status as SuggestionStatus,
    adminNote: s.adminNote,
    votes: s.voteCount,
    createdAt: s.createdAt.getTime(),
    createdAtLabel: relativeTime(s.createdAt),
    userId: s.user.id,
    userName: s.user.name,
  }));

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Ideas from staff for new rewards and profile shop items, most upvoted first. Mark each one Planned, Added or Not planned and add a reply: staff see both on the idea in Store > Ideas."
      />
      <SuggestionsManager rows={rows} />
    </div>
  );
}
