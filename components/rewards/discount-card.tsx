"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NewLabel } from "@/components/app-shell/new-items";
import { PromoBadge, RewardArt, type RewardCardData } from "@/components/rewards/reward-card";

export type DiscountCardData = Pick<RewardCardData, "id" | "name" | "description" | "imageUrl" | "isNew" | "promo"> & {
  /** The headline, e.g. "20% off". */
  discountText: string | null;
};

/**
 * A standing staff discount: always on, nothing to redeem. A wide tile with
 * the discount in big type; tapping opens how to use it.
 */
export function DiscountCard({ discount }: { discount: DiscountCardData }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="bg-surface flex w-[78%] max-w-72 shrink-0 snap-start items-center gap-3 rounded-2xl p-2.5 text-left active:opacity-80"
        >
          <span className="relative block size-16 shrink-0 overflow-hidden rounded-xl">
            <RewardArt reward={discount} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-primary truncate text-lg leading-tight font-bold" data-numeric>
                {discount.discountText}
              </span>
              {discount.isNew ? <NewLabel /> : null}
            </span>
            <span className="truncate text-sm leading-snug font-semibold">{discount.name}</span>
            {discount.promo ? (
              <PromoBadge promo={discount.promo} className="mt-0.5 self-start" />
            ) : (
              <span className="text-muted text-xs font-medium">Always on</span>
            )}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <div className="mx-4 aspect-[16/9] overflow-hidden rounded-2xl">
          <RewardArt reward={discount} />
        </div>
        <SheetHeader className="pt-4 text-left">
          {discount.promo ? <PromoBadge promo={discount.promo} withEnds className="self-start" /> : null}
          <span className="text-muted text-xs font-bold tracking-wide uppercase">Staff discount</span>
          <SheetTitle className="text-xl leading-tight font-bold">
            <span className="text-primary block text-3xl" data-numeric>
              {discount.discountText}
            </span>
            {discount.name}
          </SheetTitle>
          <SheetDescription>{discount.description ?? "Just mention you work here when you pay."}</SheetDescription>
        </SheetHeader>
        <p className="bg-surface-2 mx-4 rounded-2xl p-4 text-sm">
          <span className="font-bold">Always on.</span>{" "}
          <span className="text-muted">No points needed and nothing to claim.</span>
        </p>
        <div className="pb-safe mt-4 px-4 pb-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-surface-2 h-12 w-full rounded-xl font-bold active:opacity-80"
          >
            Got it
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
