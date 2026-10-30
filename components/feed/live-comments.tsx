"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedCardComment } from "@/lib/recognition/queries";
import type { CommentReactionSummary } from "@/lib/recognition/comment-reactions";
import {
  LIVE_OPEN_MS,
  LIVE_VISIBLE_MS,
  TYPING_PING_MS,
  typingLabel,
  type TypingUser,
} from "@/lib/recognition/live-config";
import { cn } from "@/lib/utils";

const OPTIMISTIC = "optimistic-";
const NOBODY: TypingUser[] = [];

/** What a pending comment and its saved copy have in common. */
function sameAs(c: FeedCardComment) {
  return `${c.parentId ?? ""}\n${c.body}\n${c.gifUrl ?? ""}`;
}

/** True while the element is on (or about to scroll onto) the screen. */
function useOnScreen<T extends Element>() {
  const [el, setEl] = useState<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [setEl, onScreen] as const;
}

function postTyping(recognitionId: string, typing: boolean) {
  void fetch(`/api/recognition/${recognitionId}/live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ typing }),
    // Still sent when the tab closes mid-sentence.
    keepalive: true,
  }).catch(() => {});
}

/**
 * New comments and replies, comment reactions and "is typing…" for one feed
 * card without reloading the page.
 *
 * `serverComments` are the comments the page was rendered with and `shown`
 * the same list plus the viewer's own optimistic comments. Comments fetched
 * since are added after them; a pending comment of the viewer's own drops out
 * as soon as the real one arrives. Attach `watchRef` to an element in the
 * card: polling only runs while it is on screen or the comments are open.
 * Reactions on comments are only fetched while the comments are open, since
 * that is the only place they show; `reactions` is null until then.
 */
export function useLiveComments({
  recognitionId,
  viewerId,
  serverComments,
  shown,
  open,
}: {
  recognitionId: string;
  viewerId: string;
  serverComments: FeedCardComment[];
  shown: FeedCardComment[];
  open: boolean;
}) {
  const [watchRef, onScreen] = useOnScreen<HTMLElement>();
  const [live, setLive] = useState<FeedCardComment[]>([]);
  const [typing, setTypingUsers] = useState<TypingUser[]>([]);

  const comments = useMemo(() => {
    const known = new Set(serverComments.map((c) => c.id));
    const extra = live.filter((c) => !known.has(c.id));
    // My own comments that polling already brought back, so their pending
    // copies can go.
    const arrived = extra.filter((c) => c.user.id === viewerId).map(sameAs);
    const pending = shown.filter((c) => {
      if (!c.id.startsWith(OPTIMISTIC)) return false;
      const i = arrived.indexOf(sameAs(c));
      if (i === -1) return true;
      arrived.splice(i, 1);
      return false;
    });
    return [...serverComments, ...extra, ...pending];
  }, [serverComments, live, shown, viewerId]);

  // The newest real comment we have; the server sends only what came after.
  const cursor = useRef<string | null>(null);
  const lastReal = [...comments].reverse().find((c) => !c.id.startsWith(OPTIMISTIC));
  useEffect(() => {
    cursor.current = lastReal?.id ?? null;
  }, [lastReal?.id]);

  const [reactions, setReactions] = useState<Record<string, CommentReactionSummary[]> | null>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Polls can overlap (a timed one and one right after reacting), so only the
  // newest answer sets typing and reactions. Comments only ever get added.
  const started = useRef(0);
  const applied = useRef(0);
  const poll = useCallback(async () => {
    const id = ++started.current;
    const query = new URLSearchParams();
    if (cursor.current) query.set("after", cursor.current);
    if (openRef.current) query.set("reactions", "1");
    try {
      const res = await fetch(`/api/recognition/${recognitionId}/live?${query}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        comments: FeedCardComment[];
        typing: TypingUser[];
        reactions: Record<string, CommentReactionSummary[]> | null;
      };
      if (data.comments.length > 0) {
        setLive((prev) => {
          const have = new Set(prev.map((c) => c.id));
          return [...prev, ...data.comments.filter((c) => !have.has(c.id))];
        });
      }
      if (id < applied.current) return;
      applied.current = id;
      setTypingUsers((prev) =>
        prev.map((u) => u.id).join() === data.typing.map((u) => u.id).join()
          ? prev
          : data.typing,
      );
      if (data.reactions && openRef.current) setReactions(data.reactions);
    } catch {
      // Offline for a moment: try again next round.
    }
  }, [recognitionId]);

  const active = open || onScreen;
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      if (document.visibilityState === "visible") await poll();
      if (!stopped) timer = setTimeout(tick, open ? LIVE_OPEN_MS : LIVE_VISIBLE_MS);
    }
    void tick();
    // Coming back to the tab catches up straight away.
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, open, poll]);

  // Tell others I'm typing: once at the start, then every few seconds while I
  // keep going. Clearing the box, sending or closing says I've stopped.
  const lastPing = useRef(0);
  const stopTyping = useCallback(() => {
    if (lastPing.current === 0) return;
    lastPing.current = 0;
    postTyping(recognitionId, false);
  }, [recognitionId]);
  const onDraftChange = useCallback(
    (text: string) => {
      if (!text.trim()) return stopTyping();
      const now = Date.now();
      if (now - lastPing.current < TYPING_PING_MS) return;
      lastPing.current = now;
      postTyping(recognitionId, true);
    },
    [recognitionId, stopTyping],
  );
  useEffect(() => {
    if (!open) stopTyping();
  }, [open, stopTyping]);
  useEffect(() => stopTyping, [stopTyping]);

  // Off screen nobody is polling, so whatever we last heard is stale.
  return {
    comments,
    typing: active ? typing : NOBODY,
    // Closed, the reactions stop updating, so the page's own data takes over.
    reactions: open ? reactions : null,
    watchRef,
    onDraftChange,
    stopTyping,
    /** Poll right now, e.g. just after reacting, instead of waiting a round. */
    pollNow: poll,
  };
}

/** "Ana is typing…" with bouncing dots, or nothing when nobody is. */
export function TypingLine({ users, className }: { users: TypingUser[]; className?: string }) {
  const label = typingLabel(users);
  if (!label) return null;
  return (
    <p className={cn("text-muted flex items-center gap-1.5 text-[0.85rem]", className)} aria-live="polite">
      <span className="typing-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {label}…
    </p>
  );
}
