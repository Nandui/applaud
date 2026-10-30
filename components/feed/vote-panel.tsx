"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Search, Trophy, Vote } from "lucide-react";
import { castVote, loadVoteCandidates } from "@/lib/votes/actions";
import type { VoteInfo, VotePerson } from "@/lib/votes/queries";
import { voteTimeLabel } from "@/lib/votes/schedule";
import { FramedAvatar } from "@/components/user-avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNumber, pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type Candidate = VotePerson & { siteCode: string };

const votesLabel = (n: number) => `${formatNumber(n)} ${n === 1 ? "vote" : "votes"}`;

/**
 * The picture slot of an award vote post: the question and your vote while it
 * is open, the winner and the top of the table once it closes. Clicks stop
 * here so tapping the buttons never counts as a double-tap like.
 */
export function VotePanel({ vote }: { vote: VoteInfo }) {
  return (
    <div
      className="bg-primary/8 flex min-h-[18rem] flex-col items-center justify-center gap-4 px-6 py-8 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      {vote.status === "closed" ? <VoteResults vote={vote} /> : <OpenVote vote={vote} />}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-primary/12 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
      {children}
    </span>
  );
}

function OpenVote({ vote }: { vote: VoteInfo }) {
  const [choice, setChoice] = useState<VotePerson | null>(vote.myChoice);
  const [total, setTotal] = useState(vote.totalVotes);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closing = vote.status === "closing";

  return (
    <>
      <Tag>
        <Vote className="size-3.5" /> Staff vote · {vote.label}
      </Tag>
      <div className="max-w-sm space-y-1.5">
        <p className="text-2xl leading-tight font-extrabold tracking-tight">Who should win {vote.programName}?</p>
        {vote.programDescription && (
          <p className="text-muted line-clamp-2 text-[0.9rem] leading-snug">{vote.programDescription}</p>
        )}
      </div>

      {closing ? (
        <p className="text-muted text-sm font-semibold">Voting has closed. Counting the votes…</p>
      ) : choice ? (
        <div className="flex flex-col items-center gap-2">
          <FramedAvatar name={choice.name} avatarUrl={choice.avatarUrl} frame={choice.frame} className="size-16 text-lg" />
          <p className="text-[0.95rem]">
            You voted for <span className="font-bold">{choice.name}</span>
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="text-primary text-sm font-semibold"
          >
            Change my vote
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-primary-fg flex h-12 items-center gap-2 rounded-full px-7 font-bold transition-transform active:scale-95"
        >
          <Vote className="size-4.5" /> Cast your vote
        </button>
      )}

      <p className="text-muted text-[0.8rem]">
        {votesLabel(total)} so far
        {!closing && <> · closes {voteTimeLabel(vote.closesAt)}</>}
        {vote.points > 0 && <> · winner gets +{pts(vote.points)}</>}
      </p>

      {!closing && (
        <VoteSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          vote={vote}
          choiceId={choice?.id ?? null}
          onVoted={(person) => {
            if (!choice) setTotal((n) => n + 1);
            setChoice(person);
          }}
        />
      )}
    </>
  );
}

function VoteSheet({
  open,
  onOpenChange,
  vote,
  choiceId,
  onVoted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vote: VoteInfo;
  choiceId: string | null;
  onVoted: (person: VotePerson) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, startLoading] = useTransition();
  const [voting, startVoting] = useTransition();

  // Load the people to pick from the first time the sheet opens.
  useEffect(() => {
    if (!open || candidates || loading) return;
    startLoading(async () => {
      setCandidates(await loadVoteCandidates());
    });
  }, [open, candidates, loading]);

  function pick(person: Candidate) {
    if (person.id === choiceId) {
      onOpenChange(false);
      return;
    }
    startVoting(async () => {
      const res = await castVote(vote.roundId, person.id);
      if (res.ok) {
        onVoted(person);
        toast.success(res.message ?? "Vote saved.");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const query = q.trim().toLowerCase();
  const list = (candidates ?? []).filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      (c.jobTitle ?? "").toLowerCase().includes(query) ||
      c.siteCode.toLowerCase().includes(query),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <SheetHeader className="pt-2">
          <SheetTitle className="text-base">Vote for {vote.programName}</SheetTitle>
          <SheetDescription>
            Votes are secret. You can change yours until {voteTimeLabel(vote.closesAt)}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="relative">
            <Search className="text-muted absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Who deserves it?"
              className="bg-surface-2 placeholder:text-muted h-11 w-full rounded-full pr-4 pl-10 outline-none"
            />
          </div>
          <ul className={cn("mt-2 max-h-[50svh] min-h-[30svh] overflow-y-auto", voting && "opacity-60")}>
            {candidates === null ? (
              <li className="text-muted py-10 text-center text-sm">Loading…</li>
            ) : list.length === 0 ? (
              <li className="text-muted py-10 text-center text-sm">Nobody matches that.</li>
            ) : (
              list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={voting}
                    onClick={() => pick(c)}
                    className="active:bg-surface-2 hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                  >
                    <FramedAvatar name={c.name} avatarUrl={c.avatarUrl} frame={c.frame} className="size-10 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="text-muted block truncate text-xs">
                        {[c.jobTitle, c.siteCode].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {c.id === choiceId && <Check className="text-primary size-5 shrink-0" aria-label="Your vote" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VoteResults({ vote }: { vote: VoteInfo }) {
  const top = vote.results[0]?.votes ?? 0;
  const winners = vote.winners.slice(0, 3);
  const names =
    vote.winners.length <= 1
      ? vote.winners[0]?.name
      : `${vote.winners.slice(0, -1).map((w) => w.name).join(", ")} & ${vote.winners[vote.winners.length - 1].name}`;

  return (
    <>
      <Tag>
        <Trophy className="size-3.5" /> Results · {vote.label}
      </Tag>
      {winners.length === 0 ? (
        <div className="max-w-sm space-y-1.5">
          <p className="text-2xl leading-tight font-extrabold tracking-tight">{vote.programName}</p>
          <p className="text-muted text-[0.95rem]">Nobody voted this time.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center">
            {winners.map((w, i) => (
              <span key={w.id} className={cn("relative", i > 0 && "-ml-4")} style={{ zIndex: winners.length - i }}>
                <FramedAvatar
                  name={w.name}
                  avatarUrl={w.avatarUrl}
                  frame={w.frame}
                  className={winners.length === 1 ? "size-24 text-2xl" : "size-18 text-lg"}
                  large
                />
                {i === 0 && (
                  <span aria-hidden className="absolute -right-1 -bottom-1 text-2xl">
                    🏆
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-2xl leading-tight font-extrabold tracking-tight">
              {names} {vote.winners.length === 1 ? "wins" : "win"} {vote.programName}
            </p>
            <p className="text-muted text-[0.85rem]">
              {votesLabel(top)} of {formatNumber(vote.totalVotes)}
              {vote.winners.length > 1 && " each, a tie"}
              {vote.pointsEach > 0 && <> · +{pts(vote.pointsEach)}</>}
            </p>
          </div>
          {vote.results.length > 1 && (
            <ol className="w-full max-w-sm space-y-2 text-left">
              {vote.results.map((r, i) => (
                <li key={r.person.id} className="flex items-center gap-3">
                  <span data-numeric className="text-muted w-4 text-right text-xs font-bold">
                    {i + 1}
                  </span>
                  <FramedAvatar name={r.person.name} avatarUrl={r.person.avatarUrl} frame={r.person.frame} className="size-8 text-[0.6rem]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{r.person.name}</span>
                      <span data-numeric className="text-muted shrink-0 text-xs">
                        {formatNumber(r.votes)}
                      </span>
                    </span>
                    <span className="bg-primary/12 mt-1 block h-1.5 overflow-hidden rounded-full">
                      <span
                        className="bg-primary block h-full rounded-full"
                        style={{ width: `${top ? Math.max(4, (r.votes / top) * 100) : 0}%` }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}
