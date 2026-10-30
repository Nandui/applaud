"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { markSeen } from "@/lib/seen-actions";
import { NO_NEW, type NewCounts, type SeenArea } from "@/lib/seen";

/**
 * The dots that say the Store has something you haven't seen yet. The layout
 * counts unseen items once per page load; opening the shop or the rewards list
 * stamps it seen (MarkSeen) and clears its dot here straight away, since the
 * layout itself isn't re-rendered on in-app navigation.
 */
const NewItemsContext = createContext<{ counts: NewCounts; clear: (area: SeenArea) => void }>({
  counts: NO_NEW,
  clear: () => {},
});

export function NewItemsProvider({ counts, children }: { counts: NewCounts; children: React.ReactNode }) {
  const [state, setState] = useState(counts);
  // A fresh count from the server (a refresh or full load) replaces ours.
  const [fromServer, setFromServer] = useState(counts);
  if (fromServer.shop !== counts.shop || fromServer.rewards !== counts.rewards || fromServer.claims !== counts.claims) {
    setFromServer(counts);
    setState(counts);
  }
  const clear = (area: SeenArea) => setState((s) => (s[area] === 0 ? s : { ...s, [area]: 0 }));
  return <NewItemsContext.Provider value={{ counts: state, clear }}>{children}</NewItemsContext.Provider>;
}

export function useNewItems(): NewCounts {
  return useContext(NewItemsContext).counts;
}

/** A small violet dot, shown when the given Store tabs have unseen items or claim updates. */
export function NewDot({ areas, className }: { areas: SeenArea[]; className?: string }) {
  const counts = useNewItems();
  if (!areas.some((a) => counts[a] > 0)) return null;
  return (
    <span className={cn("bg-primary inline-block size-2 shrink-0 rounded-full", className)}>
      <span className="sr-only">New items</span>
    </span>
  );
}

/** The "New" tag on a shop tile or reward card. */
export function NewLabel({ className, children = "New" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-fg rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-bold tracking-wide uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Put on the shop and rewards pages: once they're on screen, everything they
 * showed (as rendered at `renderedAt`, ms) counts as seen.
 */
export function MarkSeen({ area, renderedAt }: { area: SeenArea; renderedAt: number }) {
  const { clear } = useContext(NewItemsContext);
  useEffect(() => {
    clear(area);
    void markSeen(area, renderedAt);
    // clear is recreated each render; only the page visit matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, renderedAt]);
  return null;
}
