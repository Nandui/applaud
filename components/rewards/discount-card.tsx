"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgePercent, Check, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NewLabel } from "@/components/app-shell/new-items";
import { PromoBadge, RewardArt, type RewardCardData } from "@/components/rewards/reward-card";
import { cn } from "@/lib/utils";

export type DiscountCardData = Pick<RewardCardData, "id" | "name" | "description" | "imageUrl" | "isNew" | "promo"> & {
  /** The headline, e.g. "20% off". */
  discountText: string | null;
};

const HOW_TO = "Just mention you work here when you pay.";

/**
 * A standing staff discount: always on, nothing to redeem. A big card with
 * the square picture on top (like every reward, left uncovered), then the
 * discount in large type and what it's for; tapping opens how to use it.
 */
export function DiscountCard({ discount, className }: { discount: DiscountCardData; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-reward-id={discount.id}
          className={cn(
            "bg-background flex flex-col overflow-hidden rounded-2xl text-left shadow-sm transition-transform active:scale-[0.98]",
            className,
          )}
        >
          <span className="relative block aspect-square w-full overflow-hidden">
            <RewardArt reward={discount} icon={BadgePercent} />
            {discount.isNew ? <NewLabel className="absolute top-3 right-3 shadow" /> : null}
          </span>
          <span className="flex flex-1 flex-col gap-1 p-3.5">
            {discount.discountText ? (
              <span className="text-primary truncate text-2xl leading-none font-black tracking-tight" data-numeric>
                {discount.discountText}
              </span>
            ) : null}
            <span className="text-base leading-tight font-bold">{discount.name}</span>
            <span className="text-muted line-clamp-2 text-sm leading-snug">{discount.description ?? HOW_TO}</span>
            <span className="mt-auto pt-1.5">
              {discount.promo ? (
                <PromoBadge promo={discount.promo} className="self-start" />
              ) : (
                <span className="text-primary flex items-center gap-1 text-xs font-bold">
                  <Check className="size-3.5" strokeWidth={3} /> Always on
                </span>
              )}
            </span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <div className="mx-auto aspect-square w-[calc(100%-2rem)] max-w-64 overflow-hidden rounded-2xl">
          <RewardArt reward={discount} icon={BadgePercent} />
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
          <SheetDescription>{discount.description ?? HOW_TO}</SheetDescription>
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

/**
 * The Staff discounts panel at the top of Rewards: a violet-tinted block so
 * it reads as its own thing, not one more row of the shop. Cards scroll
 * sideways, with square pictures like the reward cards.
 */
export function StaffDiscounts({ discounts }: { discounts: DiscountCardData[] }) {
  if (discounts.length === 0) return null;
  const single = discounts.length === 1;
  return (
    <section
      id="discounts"
      aria-labelledby="discounts-heading"
      className="bg-primary/8 ring-primary/15 dark:bg-primary/15 mt-4 scroll-mt-32 overflow-hidden rounded-3xl py-4 ring-1"
    >
      <div className="flex items-center gap-3 px-4">
        <span className="bg-primary text-primary-fg flex size-10 shrink-0 items-center justify-center rounded-full">
          <BadgePercent className="size-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="discounts-heading" className="text-lg leading-tight font-bold">
            Staff discounts
          </h2>
          <p className="text-muted text-sm leading-snug">Always on for you. No points needed.</p>
        </div>
        {!single ? (
          <span className="text-primary shrink-0 text-sm font-bold" data-numeric>
            {discounts.length}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-3.5 px-4",
          "no-scrollbar flex snap-x scroll-px-4 gap-3 overflow-x-auto pb-1",
        )}
      >
        {discounts.map((d) => (
          <DiscountCard
            key={d.id}
            discount={d}
            className="w-[62%] shrink-0 snap-start sm:w-60"
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Home row pointing at the staff discounts, styled like the "Your rewards"
 * row: the best-known one up front, then how many more there are.
 */
export function DiscountsHomeRow({
  discounts,
}: {
  discounts: { name: string; discountText: string | null; isNew: boolean }[];
}) {
  if (discounts.length === 0) return null;
  const [first] = discounts;
  const more = discounts.length - 1;
  const fresh = discounts.some((d) => d.isNew);
  return (
    <Link
      href="/rewards#discounts"
      className="border-border flex items-center gap-3 border-b py-3 active:opacity-70"
    >
      <span className="bg-primary text-primary-fg flex size-10 shrink-0 items-center justify-center rounded-full">
        <BadgePercent className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[0.95rem] font-semibold">
          Your staff discounts
          {fresh ? <NewLabel /> : null}
        </span>
        <span className="text-muted block truncate text-sm">
          {first.discountText ? (
            <span className="text-primary font-bold" data-numeric>
              {first.discountText}
            </span>
          ) : null}
          {first.discountText ? " " : ""}
          {first.name}
          {more > 0 ? ` · ${more} more` : ""}
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  );
}
