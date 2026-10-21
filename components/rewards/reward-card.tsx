"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { redeemReward, type ActionResult } from "@/lib/rewards/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
};

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
  const outOfStock = reward.stock !== null && reward.stock <= 0;
  const disabled = !canAfford || outOfStock;
  const after = balance - reward.pointsCost;

  // A storefront tile (Chick-fil-A / Sweatcoin rewards grids). Tapping opens a
  // detail sheet with the balance maths and a thumb-reachable confirm button.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex flex-col text-left transition-transform active:scale-[0.97]"
        >
          <span className="bg-secondary relative block aspect-square w-full overflow-hidden rounded-2xl">
            {reward.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reward.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="from-primary/15 to-brand-2/20 text-primary flex h-full w-full items-center justify-center bg-gradient-to-br">
                <Gift className="size-10" strokeWidth={1.5} />
              </span>
            )}
            <span
              data-numeric
              className={cn(
                "absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur",
                canAfford && !outOfStock
                  ? "bg-surface/90 text-foreground"
                  : "bg-black/55 text-white",
              )}
            >
              {formatNumber(reward.pointsCost)} pts
            </span>
            {outOfStock && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-semibold">
                Sold out
              </span>
            )}
          </span>
          <span className="mt-2 line-clamp-2 text-sm leading-snug font-semibold">
            {reward.name}
          </span>
          <span className="text-muted text-xs" data-numeric>
            {outOfStock
              ? "Out of stock"
              : !canAfford
                ? `${formatNumber(reward.pointsCost - balance)} more pts to go`
                : reward.stock !== null
                  ? `${reward.stock} left`
                  : "Available"}
          </span>
          {!canAfford && !outOfStock && (
            <span className="bg-secondary mt-1.5 block h-1 overflow-hidden rounded-full">
              <span
                className="bg-brand block h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((balance / reward.pointsCost) * 100))}%`,
                }}
              />
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <div className="bg-secondary -mx-1 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl">
          {reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reward.imageUrl}
              alt={reward.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Gift className="text-primary size-12" strokeWidth={1.5} />
          )}
        </div>
        <DialogHeader className="text-left">
          {reward.category && (
            <Badge variant="secondary" className="w-fit">
              {reward.category}
            </Badge>
          )}
          <DialogTitle className="font-display text-xl leading-tight">
            {reward.name}
          </DialogTitle>
          <DialogDescription>
            {reward.description ??
              "Redeeming deducts points from your wallet straight away."}
          </DialogDescription>
        </DialogHeader>
        <dl className="bg-secondary space-y-2 rounded-2xl p-4 text-sm">
          <Row label="Cost" value={`${pts(reward.pointsCost)}`} />
          <Row label="Current balance" value={`${pts(balance)}`} />
          <div className="border-border border-t pt-2">
            <Row
              label="Balance after"
              value={`${pts(after)}`}
              strong
            />
          </div>
        </dl>
        <form action={formAction}>
          <input type="hidden" name="rewardId" value={reward.id} />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={pending || disabled}
            >
              {pending
                ? "Redeeming…"
                : outOfStock
                  ? "Sold out"
                  : canAfford
                    ? `Redeem for ${pts(reward.pointsCost)}`
                    : "Not enough points yet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <dd data-numeric className={strong ? "font-semibold" : ""}>
        {value}
      </dd>
    </div>
  );
}
