"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { redeemReward, type ActionResult } from "@/lib/rewards/actions";
import { Card, CardContent } from "@/components/ui/card";
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
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(redeemReward, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Reward requested!");
      setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const canAfford = balance >= reward.pointsCost;
  const outOfStock = reward.stock !== null && reward.stock <= 0;
  const disabled = !canAfford || outOfStock;
  const after = balance - reward.pointsCost;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="bg-secondary text-muted flex aspect-[3/1.4] items-center justify-center rounded-lg">
          {reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reward.imageUrl}
              alt={reward.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <Gift className="size-8" />
          )}
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display leading-tight font-semibold">
              {reward.name}
            </h3>
            {reward.category && (
              <Badge variant="secondary" className="shrink-0">
                {reward.category}
              </Badge>
            )}
          </div>
          {reward.description && (
            <p className="text-muted text-sm">{reward.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <span data-numeric className="text-lg font-semibold">
              {formatNumber(reward.pointsCost)}
            </span>
            <span className="text-muted ml-1 text-sm">pts</span>
            {reward.stock !== null && (
              <p
                className={cnStock(reward.stock)}
                data-numeric
              >
                {reward.stock > 0 ? `${reward.stock} left` : "Out of stock"}
              </p>
            )}
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={disabled}>
                {outOfStock ? "Sold out" : canAfford ? "Redeem" : "Not enough"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Redeem {reward.name}?</DialogTitle>
                <DialogDescription>
                  This will deduct points from your wallet straight away.
                </DialogDescription>
              </DialogHeader>
              <dl className="border-border space-y-2 rounded-lg border p-3 text-sm">
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
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending || disabled}>
                    {pending ? "Redeeming…" : "Confirm redemption"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
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

function cnStock(stock: number) {
  return stock > 0
    ? "text-muted text-xs"
    : "text-danger text-xs font-medium";
}
