"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Vote } from "lucide-react";
import {
  closeVoteNow,
  openVoteNow,
  saveVoteSchedule,
  type ActionResult,
} from "@/lib/votes/actions";
import { maxVoteDays } from "@/lib/votes/form";
import {
  VOTE_INTERVALS,
  VOTE_ROLES,
  VOTE_ROLE_LABELS,
  isVoteInterval,
  toDateInput,
  voteTimeLabel,
  type VoteInterval,
  type VoteRole,
} from "@/lib/votes/schedule";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OFF = "off";
const EVERY_OPTIONS: { value: VoteInterval | typeof OFF; label: string }[] = [
  { value: OFF, label: "Off" },
  ...VOTE_INTERVALS.map((v) => ({
    value: v,
    label: v === "week" ? "Weekly" : v === "month" ? "Monthly" : "Quarterly",
  })),
];

function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-surface-2 flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 flex-1 rounded-full px-2 text-[0.82rem] font-semibold transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type VoteScheduleValues = {
  voteEvery: string | null;
  voteDays: number;
  nextVoteAt: string | null;
  voteRole: string;
};

/**
 * How often an award goes to a staff vote, how long each vote stays open and
 * when the next one opens. Posts voteEvery, voteDays and nextVoteOn (and
 * voteRole when `withRole`), read by lib/votes/form.ts.
 */
export function VoteScheduleFields({
  initial,
  withRole = false,
}: {
  initial: VoteScheduleValues;
  withRole?: boolean;
}) {
  const [every, setEvery] = useState<VoteInterval | typeof OFF>(
    isVoteInterval(initial.voteEvery) ? initial.voteEvery : OFF,
  );
  const [role, setRole] = useState<VoteRole>(
    (VOTE_ROLES as readonly string[]).includes(initial.voteRole) ? (initial.voteRole as VoteRole) : "admin",
  );
  const maxDays = maxVoteDays(every === OFF ? null : every);

  return (
    <div className="space-y-3">
      <input type="hidden" name="voteEvery" value={every} />
      {withRole && <input type="hidden" name="voteRole" value={role} />}
      <div className="space-y-1.5">
        <Label>Put to a staff vote</Label>
        <Pills label="How often" options={EVERY_OPTIONS} value={every} onChange={setEvery} />
      </div>
      {every !== OFF && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nextVoteOn">Next vote opens</Label>
            <Input
              id="nextVoteOn"
              name="nextVoteOn"
              type="date"
              defaultValue={toDateInput(initial.nextVoteAt ? new Date(initial.nextVoteAt) : null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="voteDays">Open for (days)</Label>
            <Input
              id="voteDays"
              name="voteDays"
              type="number"
              min={1}
              max={maxDays}
              defaultValue={Math.min(initial.voteDays, maxDays)}
              className="font-mono"
              required
            />
          </div>
          <p className="text-muted col-span-2 -mt-1 text-xs">
            Votes open at 09:00 Irish time and repeat {every === "week" ? "weekly" : every === "month" ? "monthly" : "quarterly"} from that date. Leave the date empty to start next {every}.
          </p>
        </div>
      )}
      {every === OFF && <input type="hidden" name="voteDays" value={initial.voteDays} />}
      {withRole && (
        <div className="space-y-1.5">
          <Label>Who runs the vote</Label>
          <Pills
            label="Who runs the vote"
            options={VOTE_ROLES.map((r) => ({ value: r, label: VOTE_ROLE_LABELS[r] }))}
            value={role}
            onChange={setRole}
          />
          <p className="text-muted text-xs">
            They can change how often it&apos;s voted on and open or close a vote from the Awards page. Admins always can.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "Vote settings" on an award for the people who run its vote: the schedule,
 * plus opening a vote now or closing the open one early.
 */
export function VoteSettingsSheet({
  program,
  openRound,
}: {
  program: { id: string; name: string } & VoteScheduleValues;
  openRound: { closesAt: string; totalVotes: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [, formAction, saving] = useActionState<ActionResult | undefined, FormData>(async (prev, fd) => {
    const res = await saveVoteSchedule(prev, fd);
    if (res.ok) {
      toast.success(res.message ?? "Saved.");
      setOpen(false);
    } else {
      toast.error(res.error);
    }
    return res;
  }, undefined);

  function run(action: (id: string) => Promise<ActionResult>) {
    start(async () => {
      const res = await action(program.id);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="bg-surface-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold active:opacity-80"
        >
          <Vote className="size-4" /> Vote settings
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <SheetHeader className="pt-2">
          <SheetTitle className="text-base">{program.name} vote</SheetTitle>
          <SheetDescription>
            When a vote opens, a post goes up in the feed and everyone can vote for a colleague. The most votes wins.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4 px-4 pb-4">
          <input type="hidden" name="programId" value={program.id} />
          <VoteScheduleFields initial={program} />
          <button
            type="submit"
            disabled={saving || busy}
            className="bg-primary text-primary-fg h-12 w-full rounded-full font-bold disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
          <div className="border-border border-t pt-4">
            {openRound ? (
              <>
                <p className="text-muted mb-2 text-center text-sm">
                  A vote is open until {voteTimeLabel(openRound.closesAt)} ({openRound.totalVotes}{" "}
                  {openRound.totalVotes === 1 ? "vote" : "votes"} so far).
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(closeVoteNow)}
                  className="text-danger bg-danger/10 h-11 w-full rounded-full text-sm font-bold disabled:opacity-40"
                >
                  Close the vote now and announce the winner
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(openVoteNow)}
                className="bg-surface-2 h-11 w-full rounded-full text-sm font-bold disabled:opacity-40"
              >
                Open a vote now
              </button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
