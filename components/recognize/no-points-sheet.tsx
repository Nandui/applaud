"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { pts } from "@/lib/format";

/**
 * Asked when someone shares a recognition with no points attached but still
 * has points to give: go back and add some, or send it as it is.
 */
export function NoPointsSheet({
  open,
  onOpenChange,
  names,
  people,
  remaining,
  cover = false,
  onAddPoints,
  onSendAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Cian", "Cian & Saoirse", "Cian, Saoirse +2". */
  names: string;
  people: number;
  /** Points the sender has left to give this month. */
  remaining: number;
  cover?: boolean;
  onAddPoints: () => void;
  onSendAnyway: () => void;
}) {
  const them = people > 1 ? "them" : names;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="flex flex-col items-center pt-3 text-center">
          <span
            aria-hidden
            className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full text-2xl"
          >
            ✦
          </span>
          <SheetHeader className="items-center px-0 pt-3 pb-0">
            <SheetTitle className="font-display text-xl">No points attached</SheetTitle>
            <SheetDescription className="max-w-xs text-[0.95rem]">
              {cover ? "Your thanks" : "Your recognition"} for {names} will go out without any
              points. You have <span data-numeric className="text-foreground font-semibold">{pts(remaining)}</span>{" "}
              left to give this month if you&apos;d like to add some for {them}.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onAddPoints}
            className="bg-primary text-primary-fg flex h-12 w-full items-center justify-center rounded-xl text-[0.95rem] font-bold active:opacity-80"
          >
            Add points
          </button>
          <button
            type="button"
            onClick={onSendAnyway}
            className="h-12 w-full rounded-xl text-[0.95rem] font-semibold active:opacity-70"
          >
            Send without points
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
