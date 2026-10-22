"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buyBundle } from "@/lib/profile-actions";
import { KIND_LABELS, type Cosmetic } from "@/lib/cosmetics";
import { formatNumber, pts } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * "Buy all" for a Store category: every item in it you don't own yet, at the
 * plain sum of their prices. Opens a sheet listing exactly what you'd get.
 */
export function BundleCard({
  categoryId,
  categoryName,
  items,
  price,
  total,
  balance,
}: {
  categoryId: string;
  categoryName: string;
  /** What "Buy all" would buy (for sale, not owned yet). */
  items: Cosmetic[];
  price: number;
  /** How many items are for sale in the category, owned or not. */
  total: number;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const short = price - balance;

  if (items.length === 0) {
    return <p className="text-muted text-sm">You own everything in {categoryName}.</p>;
  }

  const buy = () =>
    start(async () => {
      const res = await buyBundle(categoryId, price);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="border-border bg-surface flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-opacity active:opacity-70"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {price === 0 ? "Get all of" : "Buy all of"} {categoryName}
            </span>
            <span className="text-muted block text-xs" data-numeric>
              {items.length === total
                ? `${items.length} ${items.length === 1 ? "item" : "items"}`
                : `The ${items.length} you don't have yet`}
            </span>
          </span>
          <span className="bg-primary text-primary-fg shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold" data-numeric>
            {price === 0 ? "Free" : pts(price)}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <SheetHeader className="pt-2 text-left">
          <p className="text-muted text-xs font-semibold">Bundle</p>
          <SheetTitle className="text-xl font-bold">All of {categoryName}</SheetTitle>
          <SheetDescription>
            Same price as buying each one. They go in your collection, and you pick what to wear.
          </SheetDescription>
        </SheetHeader>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto px-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {item.name} <span className="text-muted">· {KIND_LABELS[item.kind].one}</span>
              </span>
              <span className="text-muted shrink-0" data-numeric>
                {item.price === 0 ? "Free" : pts(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="pb-safe mt-4 space-y-2 px-4 pb-4">
          <button
            type="button"
            disabled={pending || short > 0}
            onClick={buy}
            className="bg-primary text-primary-fg h-12 w-full rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-40"
          >
            {pending
              ? price === 0
                ? "Getting them…"
                : "Buying…"
              : price === 0
                ? "Get them all free"
                : short > 0
                  ? `You need ${pts(short)} more`
                  : `Buy all for ${pts(price)}`}
          </button>
          <p className="text-muted text-center text-xs" data-numeric>
            You have {formatNumber(balance)} pts
            {short <= 0 ? ` · ${formatNumber(balance - price)} left after` : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
