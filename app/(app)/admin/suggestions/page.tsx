import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/datetime";
import { getOrgSettings } from "@/lib/org-settings";
import { chatConfigured } from "@/lib/chat/google-chat";
import { emailOn } from "@/lib/email/switches";
import { PageHeader } from "@/components/page-header";
import { SuggestionsManager, type ItemOption, type SuggestionRow } from "@/components/admin/suggestions-manager";
import type { SuggestionKind, SuggestionStatus } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suggestions" };

const COSMETIC_KIND: Record<string, string> = { frame: "Frame", banner: "Banner", theme: "Theme" };

export default async function AdminSuggestionsPage() {
  await requireAdmin();

  const [suggestions, rewards, cosmetics, settings] = await Promise.all([
    prisma.suggestion.findMany({
      orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true } } },
    }),
    // Newest first: the one just added for an idea sits at the top of the picker.
    prisma.reward.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, imageUrl: true, active: true, category: true },
    }),
    prisma.cosmetic.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, imageUrl: true, active: true, kind: true, style: true },
    }),
    getOrgSettings(),
  ]);

  const items: Record<SuggestionKind, ItemOption[]> = {
    reward: rewards.map((r) => ({ id: r.id, name: r.name, imageUrl: r.imageUrl, active: r.active, detail: r.category, swatch: null })),
    shop: cosmetics.map((c) => ({
      id: c.id, name: c.name, imageUrl: c.imageUrl, active: c.active, detail: COSMETIC_KIND[c.kind] ?? null,
      // Built-in banners and themes have no picture: show their colours instead.
      swatch: c.kind === "frame" ? null : c.style,
    })),
  };
  const names = new Map([...rewards, ...cosmetics].map((i) => [i.id, i.name]));

  const rows: SuggestionRow[] = suggestions.map((s) => {
    const itemId = s.kind === "shop" ? s.cosmeticId : s.rewardId;
    return {
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
      itemId: itemId && names.has(itemId) ? itemId : null,
      itemName: itemId ? (names.get(itemId) ?? null) : null,
      announced: s.announcedAt !== null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Ideas from staff for new rewards and profile shop items, most upvoted first. Approve the ones you'll do (staff see Coming soon), then once you've added it in Rewards or Store, mark it Available and pick the item: the person who suggested it gets an email and the staff Chat space hears about it."
      />
      <SuggestionsManager
        rows={rows}
        items={items}
        notify={{
          email: emailOn(settings, "suggestion"),
          chat: settings.chatSuggestions && chatConfigured(),
        }}
      />
    </div>
  );
}
