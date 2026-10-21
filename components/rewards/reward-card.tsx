"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Gift, Lock } from "lucide-react";
import { redeemReward, type ActionResult } from "@/lib/rewards/actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatNumber, pts } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RewardCardData = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stock: number | null;
  /** Claims left this month (monthly stock), null when there's no monthly limit. */
  monthLeft: number | null;
  /** Set when this month's allocation is all claimed: the day it comes back, e.g. "1 November". */
  backOn: string | null;
};

// Placeholder art when a reward has no image: a gradient picked from the name.
const ART = [
  "from-[#7c5cff] to-[#d14dff]",
  "from-[#ff4f9a] to-[#ff9f43]",
  "from-[#22d3ee] to-[#7c5cff]",
  "from-[#34d399] to-[#22d3ee]",
  "from-[#ff9f43] to-[#fde047]",
];
function artFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ART[Math.abs(h) % ART.length];
}

function RewardArt({ reward, className }: { reward: RewardCardData; className?: string }) {
  return reward.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={reward.imageUrl} alt="" className={cn("h-full w-full object-cover", className)} />
  ) : (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
        artFor(reward.name),
        className,
      )}
    >
      <Gift className="size-10 drop-shadow" strokeWidth={1.6} />
    </span>
  );
}

export function RewardCard({
  reward,
  balance,
}: {
  reward: RewardCardData;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  // Toast + close from inside the action (not an effect watching its state).
  const [, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prev, fd) => {
    const res = await redeemReward(prev, fd);
    if (res.ok) {
      toast.success(res.message ?? "Reward requested!");
      setOpen(false);
    } else {
      toast.error(res.error);
    }
    return res;
  }, undefined);

  const canAfford = balance >= reward.pointsCost;
  const outOfStock = (reward.stock !== null && reward.stock <= 0) || reward.backOn !== null;
  const left =
    reward.stock !== null && reward.monthLeft !== null
      ? Math.min(reward.stock, reward.monthLeft)
      : (reward.stock ?? reward.monthLeft);
  const disabled = !canAfford || outOfStock;
  const after = balance - reward.pointsCost;
  const progress = Math.min(100, Math.round((balance / reward.pointsCost) * 100));

  // A store tile: square picture, name, price. Tapping opens a bottom sheet
  // with the balance maths and a thumb-reachable redeem button.
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group flex flex-col overflow-hidden text-left active:opacity-80"
        >
          <span className="relative block aspect-square w-full overflow-hidden rounded-xl">
            <RewardArt reward={reward} />
            {outOfStock ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">
                {reward.backOn ? "All claimed" : "Sold out"}
              </span>
            ) : !canAfford ? (
              <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                <Lock className="size-3.5" />
              </span>
            ) : null}
          </span>
          <span className="flex flex-1 flex-col pt-2">
            <span className="line-clamp-2 text-sm leading-snug font-bold">{reward.name}</span>
            <span className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span
                data-numeric
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  canAfford && !outOfStock ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground",
                )}
              >
                ✦ {formatNumber(reward.pointsCost)}
              </span>
              <span className="text-muted truncate text-[11px] font-medium" data-numeric>
                {outOfStock
                  ? reward.backOn
                    ? `Back ${reward.backOn}`
                    : "Out of stock"
                  : !canAfford
                    ? `${formatNumber(reward.pointsCost - balance)} to go`
                    : left !== null
                      ? `${left} left${reward.monthLeft !== null ? " this month" : ""}`
                      : "Ready"}
              </span>
            </span>
            {!canAfford && !outOfStock ? (
              <span className="bg-surface-2 mt-2 block h-1.5 overflow-hidden rounded-full">
                <span className="bg-primary block h-full rounded-full" style={{ width: `${progress}%` }} />
              </span>
            ) : null}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <div className="mx-4 aspect-[16/9] overflow-hidden rounded-2xl">
          <RewardArt reward={reward} />
        </div>
        <SheetHeader className="pt-4 text-left">
          {reward.category ? (
            <span className="text-muted text-xs font-bold tracking-wide uppercase">{reward.category}</span>
          ) : null}
          <SheetTitle className="text-xl leading-tight font-bold">{reward.name}</SheetTitle>
          <SheetDescription>
            {reward.description ?? "Redeeming deducts points from your wallet straight away."}
          </SheetDescription>
        </SheetHeader>
        <dl className="bg-surface-2 mx-4 space-y-2 rounded-2xl p-4 text-sm">
          <Row label="Cost" value={pts(reward.pointsCost)} />
          <Row label="Your balance" value={pts(balance)} />
          {left !== null && !outOfStock ? (
            <Row label={reward.monthLeft !== null ? "Left this month" : "Left"} value={formatNumber(left)} />
          ) : null}
          <div className="border-border border-t pt-2">
            <Row label="After redeeming" value={canAfford ? pts(after) : "Not enough yet"} strong />
          </div>
        </dl>
        <form action={formAction} className="pb-safe mt-4 flex gap-2 px-4 pb-4">
          <input type="hidden" name="rewardId" value={reward.id} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-surface-2 h-12 rounded-xl px-5 font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || disabled}
            className="bg-primary text-primary-fg h-12 flex-1 rounded-xl font-bold active:opacity-80 disabled:opacity-45"
          >
            {pending
              ? "Redeeming…"
              : outOfStock
                ? reward.backOn
                  ? `All claimed, back on ${reward.backOn}`
                  : "Sold out"
                : canAfford
                  ? `Redeem for ${pts(reward.pointsCost)}`
                  : `${formatNumber(reward.pointsCost - balance)} more pts to go`}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd data-numeric className={strong ? "font-bold" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
