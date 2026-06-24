import Link from "next/link";
import { Plus, MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getFeedCards } from "@/lib/recognition/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { FeedComposer } from "@/components/feed/feed-composer";
import { StoriesRow } from "@/components/feed/stories-row";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const me = await requireUser();
  const cards = await getFeedCards(me.id);
  const viewer = { id: me.id, name: me.name, avatarUrl: me.avatarUrl ?? null };

  // Build the "stories" strip from people recently active in the feed.
  const peopleMap = new Map<
    string,
    { id: string; name: string; avatarUrl: string | null }
  >();
  for (const c of cards) {
    if (!c.system) {
      peopleMap.set(c.sender.id, {
        id: c.sender.id,
        name: c.sender.name,
        avatarUrl: c.sender.avatarUrl,
      });
    }
    for (const r of c.recipients) {
      peopleMap.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl });
    }
  }
  const people = [...peopleMap.values()].slice(0, 14);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <FeedComposer viewer={{ name: me.name, avatarUrl: me.avatarUrl }} />

      {people.length > 0 && <StoriesRow people={people} />}

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="bg-secondary text-muted flex size-12 items-center justify-center rounded-full">
              <MessageSquareHeart className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="font-display font-medium">No recognition yet</p>
              <p className="text-muted max-w-sm text-sm">
                Be the first to recognise a colleague for great work.
              </p>
            </div>
            <Button asChild>
              <Link href="/recognize">
                <Plus className="size-4" /> Give recognition
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card, i) => (
            <RecognitionCard
              key={card.id}
              card={card}
              index={i}
              viewer={viewer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
