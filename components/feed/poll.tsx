"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { votePoll } from "@/lib/posts/actions";
import { percentOf } from "@/lib/posts/kinds";
import type { FeedPoll } from "@/lib/recognition/queries";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A poll's choices under its question. Tap a choice to vote; tap another to
 * change your vote while the poll is open. Once you have voted (and the
 * asker shares results) each choice fills like a bar with its percentage.
 * Votes are anonymous: nobody sees who picked what.
 */
export function PollChoices({
  pollId,
  poll,
  isAsker,
  askerName,
}: {
  pollId: string;
  poll: FeedPoll;
  isAsker: boolean;
  askerName: string;
}) {
  const [pending, startVote] = useTransition();
  const [state, applyVote] = useOptimistic(poll, (current: FeedPoll, optionId: string) => {
    const before = current.myOptionId;
    if (before === optionId) return current;
    const showNow = isAsker || current.showResultsToVoters;
    return {
      ...current,
      myOptionId: optionId,
      totalVotes: current.totalVotes + (before ? 0 : 1),
      resultsVisible: showNow,
      // Until the server answers with real counts, nudge the ones we know.
      options: current.options.map((o) => {
        if (!showNow) return { ...o, votes: null };
        let votes = o.votes ?? 0;
        if (o.id === optionId) votes += 1;
        if (o.id === before) votes -= 1;
        return { ...o, votes: Math.max(0, votes) };
      }),
    };
  });

  const canVote = !state.closed;
  const shown = state.resultsVisible;
  const leader = shown ? Math.max(...state.options.map((o) => o.votes ?? 0)) : 0;

  function vote(optionId: string) {
    if (!canVote || pending || optionId === state.myOptionId) return;
    startVote(async () => {
      applyVote(optionId);
      const res = await votePoll(pollId, optionId);
      if (!res.ok) toast.error(res.error);
    });
  }

  const first = askerName.split(" ")[0] ?? askerName;
  const footer: string[] = [
    `${formatNumber(state.totalVotes)} ${state.totalVotes === 1 ? "vote" : "votes"}`,
  ];
  if (state.closesLabel) footer.push(state.closesLabel);

  return (
    <div className="mt-3">
      <ul className="space-y-2" aria-label="Poll choices">
        {state.options.map((o) => {
          const mine = o.id === state.myOptionId;
          const pct = shown ? percentOf(o.votes ?? 0, state.totalVotes) : 0;
          const top = shown && (o.votes ?? 0) === leader && leader > 0;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => vote(o.id)}
                disabled={!canVote}
                aria-pressed={mine}
                className={cn(
                  "relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-xl border px-4 py-2.5 text-left transition-[transform,border-color] active:scale-[0.99] disabled:active:scale-100",
                  mine ? "border-primary" : "border-border",
                  canVote && !mine && "hover:border-foreground/30",
                )}
              >
                {shown && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                      mine ? "bg-primary/18" : "bg-surface-2",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span
                  className={cn(
                    "relative min-w-0 flex-1 text-[0.95rem] break-words",
                    (mine || top) && "font-bold",
                  )}
                >
                  {o.label}
                </span>
                {mine && (
                  <span className="bg-primary text-primary-fg relative flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
                {shown && (
                  <span data-numeric className="relative w-10 shrink-0 text-right text-sm font-semibold">
                    {pct}%
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-muted mt-2 flex flex-wrap items-center gap-x-1.5 text-[0.82rem]">
        <span data-numeric>{footer.join(" · ")}</span>
        {!state.closed && !state.myOptionId && <span>· Tap to vote</span>}
        {state.myOptionId && !state.closed && <span>· Tap another to change</span>}
      </p>
      {!state.showResultsToVoters && (
        <p className="text-muted mt-1 flex items-center gap-1.5 text-[0.82rem]">
          <Lock className="size-3.5" />
          {isAsker ? "Only you can see the results" : `Only ${first} sees the results`}
        </p>
      )}
      {isAsker && state.showResultsToVoters && !state.closed && (
        <p className="text-muted mt-1 text-[0.82rem]">People see the results once they vote. Votes are anonymous.</p>
      )}
    </div>
  );
}
