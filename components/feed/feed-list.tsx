"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { loadMoreFeed, refreshFeedCards } from "@/lib/recognition/feed-actions";
import type { FeedCard } from "@/lib/recognition/queries";

type Viewer = Parameters<typeof RecognitionCard>[0]["viewer"];

/**
 * The home feed. Shows the first page from the server, then loads the next
 * page as the reader nears the bottom, until there is nothing older left.
 */
export function FeedList({
  initialCards,
  initialCursor,
  viewer,
  pinnedIds,
}: {
  initialCards: FeedCard[];
  initialCursor: string | null;
  viewer: Viewer;
  pinnedIds: string[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const pins = new Set(pinnedIds);

  // When the server sends a fresh first page (after a reaction, comment or new
  // post), swap it in and keep the older cards already scrolled to, refreshed
  // so their reactions and comments stay current.
  const firstRender = useRef(true);
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let cancelled = false;
    const top = new Set(initialCards.map((c) => c.id));
    const older = cardsRef.current.filter((c) => !top.has(c.id));
    setCards([...initialCards, ...older]);
    if (older.length > 0) {
      refreshFeedCards(older.map((c) => c.id))
        .then((fresh) => {
          if (!cancelled) setCards([...initialCards, ...fresh.filter((c) => !top.has(c.id))]);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [initialCards]);

  const loadMore = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreFeed(cursor);
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.cards.filter((c) => !seen.has(c.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || failed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, failed, loadMore]);

  return (
    <div>
      {cards.map((card, i) => (
        <RecognitionCard
          key={card.id}
          card={card}
          index={i}
          viewer={viewer}
          pinned={pins.has(card.id)}
        />
      ))}
      {cursor ? (
        <div ref={sentinel} className="flex justify-center py-10">
          {failed ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="bg-surface-2 h-10 rounded-full px-5 text-sm font-semibold"
            >
              Couldn&apos;t load more. Try again
            </button>
          ) : (
            <span className="text-muted flex items-center gap-2 text-sm" aria-live="polite">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Loading more…
            </span>
          )}
        </div>
      ) : (
        <p className="text-muted py-10 text-center text-sm">You&apos;re all caught up ✨</p>
      )}
    </div>
  );
}
