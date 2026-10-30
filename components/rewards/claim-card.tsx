import { Check, Clock, MessageSquare } from "lucide-react";
import { RewardArt } from "@/components/rewards/reward-card";
import { claimStatusLabel, expectedByLabel } from "@/lib/fulfilment";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClaimCardData = {
  id: string;
  status: string;
  pointsCost: number;
  createdAt: string;
  approvedAt: string | null;
  fulfilledAt: string | null;
  /** When it was promised by, from the reward's fulfilment time at claim time. */
  expectedBy: string | null;
  /** Hour-based waits show a time as well as the day. */
  withTime: boolean;
  /** "Within 5 working days", as promised when it was claimed. */
  fulfilmentLabel: string | null;
  overdue: boolean;
  /** The admin's message, e.g. "Collect it from reception". */
  staffNote: string | null;
  reward: { name: string; imageUrl: string | null };
};

export const CLAIM_STATUS_TONE: Record<string, string> = {
  requested: "bg-warning/15 text-warning",
  approved: "bg-primary/15 text-primary",
  fulfilled: "bg-success/15 text-success",
  cancelled: "bg-danger/10 text-danger",
};

export function ClaimStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        CLAIM_STATUS_TONE[status] ?? "bg-surface-2 text-muted",
        className,
      )}
    >
      {claimStatusLabel(status)}
    </span>
  );
}

const day = (iso: string) => expectedByLabel(new Date(iso));

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "In progress" },
  { key: "fulfilled", label: "Fulfilled" },
] as const;

/** Requested -> In progress -> Fulfilled, with the day each step happened. */
function Progress({ claim }: { claim: ClaimCardData }) {
  const reached = claim.status === "fulfilled" ? 2 : claim.status === "approved" ? 1 : 0;
  const when = [claim.createdAt, claim.approvedAt, claim.fulfilledAt];
  return (
    <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Progress">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        return (
          <li key={step.key} className="min-w-0" aria-current={i === reached ? "step" : undefined}>
            <span className={cn("block h-1.5 rounded-full", done ? "bg-primary" : "bg-surface-3")} />
            <span
              className={cn(
                "mt-1.5 flex items-center gap-1 truncate text-[11px] font-semibold",
                done ? "text-foreground" : "text-muted",
              )}
            >
              {done && i < reached ? <Check className="size-3 shrink-0" aria-hidden /> : null}
              {step.label}
            </span>
            {done && when[i] ? (
              <span className="text-muted block truncate text-[11px]" data-numeric>
                {day(when[i]!)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** What to expect, in one line. */
function Expectation({ claim }: { claim: ClaimCardData }) {
  if (claim.status === "fulfilled") {
    return claim.fulfilledAt ? <>Fulfilled on {day(claim.fulfilledAt)}. Enjoy!</> : <>Fulfilled. Enjoy!</>;
  }
  if (claim.status === "cancelled") {
    return <>Cancelled. {formatNumber(claim.pointsCost)} pts went back to your wallet.</>;
  }
  if (!claim.expectedBy) return <>We&apos;ll update this as it&apos;s sorted.</>;
  const by = expectedByLabel(new Date(claim.expectedBy), claim.withTime);
  if (claim.overdue) return <>Taking longer than expected (was due {by}). It&apos;s still on its way.</>;
  return (
    <>
      Expected by <span className="text-foreground font-semibold">{by}</span>
      {claim.fulfilmentLabel ? ` · ${claim.fulfilmentLabel.toLowerCase()}` : null}
    </>
  );
}

export function ClaimCard({ claim }: { claim: ClaimCardData }) {
  const cancelled = claim.status === "cancelled";
  return (
    <article className="bg-surface rounded-2xl p-3.5">
      <div className="flex items-start gap-3">
        <span className={cn("size-14 shrink-0 overflow-hidden rounded-xl", cancelled && "opacity-50 grayscale")}>
          <RewardArt reward={claim.reward} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 leading-snug font-bold">{claim.reward.name}</h3>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <p className="text-muted mt-0.5 text-xs" data-numeric>
            Claimed {day(claim.createdAt)} · ✦ {formatNumber(claim.pointsCost)}
          </p>
        </div>
      </div>
      {cancelled ? null : <Progress claim={claim} />}
      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 text-sm",
          claim.overdue ? "text-warning" : "text-muted",
        )}
      >
        {claim.status === "fulfilled" ? (
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <span>
          <Expectation claim={claim} />
        </span>
      </p>
      {claim.staffNote ? (
        <p className="bg-surface-2 mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
          <MessageSquare className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words whitespace-pre-line">{claim.staffNote}</span>
        </p>
      ) : null}
    </article>
  );
}
