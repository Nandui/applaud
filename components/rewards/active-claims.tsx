import Link from "next/link";
import { ChevronRight, PackageOpen } from "lucide-react";
import { RewardArt } from "@/components/rewards/reward-card";
import { CLAIM_STATUS_TONE } from "@/components/rewards/claim-card";
import type { ActiveClaim } from "@/lib/claims";
import { cn } from "@/lib/utils";

function UpdatedDot() {
  return (
    <span className="bg-primary ring-surface absolute -top-1 -right-1 size-3 rounded-full ring-2">
      <span className="sr-only">Updated</span>
    </span>
  );
}

/** The top of the Rewards page: each claim on the way, with where it's up to. */
export function ClaimsStrip({ claims }: { claims: ActiveClaim[] }) {
  if (claims.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="claims-heading">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="claims-heading" className="text-[0.95rem] font-bold">
          Your rewards on the way
        </h2>
        <Link
          href="/rewards/claimed"
          className="text-primary text-sm font-semibold"
        >
          See all
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {claims.map((c) => (
          <Link
            key={c.id}
            href="/rewards/claimed"
            className="bg-surface flex w-[78%] max-w-72 shrink-0 snap-start items-center gap-3 rounded-2xl p-3 active:opacity-80"
          >
            <span className="relative size-12 shrink-0">
              <span className="block size-12 overflow-hidden rounded-xl">
                <RewardArt
                  reward={{ name: c.rewardName, imageUrl: c.imageUrl }}
                />
              </span>
              {c.updated ? <UpdatedDot /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {c.rewardName}
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    CLAIM_STATUS_TONE[c.status] ?? "bg-surface-2 text-muted",
                  )}
                >
                  {c.statusLabel}
                </span>
                {c.status === "requested" || c.status === "approved" ? (
                  <span
                    className={cn(
                      "truncate text-[11px] font-medium",
                      c.overdue ? "text-warning" : "text-muted",
                    )}
                    data-numeric
                  >
                    {c.detail}
                  </span>
                ) : null}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * One row under the Home prompt while anything is on the way or has news:
 * the most relevant claim, how many more, and a tap through to My rewards.
 */
export function ClaimsHomeRow({ claims }: { claims: ActiveClaim[] }) {
  if (claims.length === 0) return null;
  const [first] = claims;
  const updates = claims.filter((c) => c.updated).length;
  const more = claims.length - 1;
  return (
    <Link
      href="/rewards/claimed"
      className="border-border flex items-center gap-3 border-b py-3 active:opacity-70"
    >
      <span className="bg-primary/12 text-primary relative flex size-10 shrink-0 items-center justify-center rounded-full">
        <PackageOpen className="size-5" />
        {updates > 0 ? <UpdatedDot /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold">
          {updates > 0
            ? updates === 1
              ? "Your reward has an update"
              : `${updates} reward updates`
            : "Your rewards"}
        </span>
        <span className="text-muted block truncate text-sm">
          {first.rewardName} · {first.statusLabel}
          {first.status === "requested" || first.status === "approved"
            ? ` · ${first.detail}`
            : ""}
          {more > 0 ? ` · ${more} more` : ""}
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  );
}
