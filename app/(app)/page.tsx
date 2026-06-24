import Link from "next/link";
import { Plus, MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getFeedCards } from "@/lib/recognition/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecognitionCard } from "@/components/feed/recognition-card";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const me = await requireUser();
  const cards = await getFeedCards(me.id);

  return (
    <div>
      <PageHeader
        title="Recognition feed"
        description="See who's being recognised across the team."
        action={
          <Button asChild>
            <Link href="/recognize">
              <Plus className="size-4" /> Recognise
            </Link>
          </Button>
        }
      />

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
        <div className="mx-auto max-w-2xl space-y-4">
          {cards.map((card, i) => (
            <RecognitionCard key={card.id} card={card} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
