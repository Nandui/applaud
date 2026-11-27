"use client";

import { useState, useTransition } from "react";
import { Pin, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { pinToFeed } from "@/lib/recognition/feed-pin-actions";
import { MAX_PIN_DAYS, PIN_DURATIONS, todayInDublin, type PinChoice, type PinDurationKey } from "@/lib/feed-pins";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** "2026-12-05" plus n days, as YYYY-MM-DD. */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Choose how long a recognition or post stays at the top of the Home feed:
 * a preset length or until the end of a chosen day.
 */
export function PinToFeedSheet({
  open,
  onOpenChange,
  recognitionId,
  noun,
  changing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recognitionId: string;
  noun: string;
  /** Already pinned: this changes how long it stays. */
  changing: boolean;
}) {
  const [pick, setPick] = useState<PinDurationKey | "date">("3d");
  const today = todayInDublin();
  const [date, setDate] = useState(() => addDays(today, 7));
  const [pending, start] = useTransition();

  function submit() {
    const choice: PinChoice = pick === "date" ? { untilDate: date } : { duration: pick };
    start(async () => {
      const res = await pinToFeed({ recognitionId, choice });
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
        <SheetHeader className="border-b pt-1 pb-3">
          <SheetTitle className="text-center text-base">
            {changing ? "Change how long it's pinned" : "Pin to top of feed"}
          </SheetTitle>
          <SheetDescription className="text-center text-[0.82rem]">
            Everyone sees this {noun} first on Home. When the time is up it goes back to its usual place.
          </SheetDescription>
        </SheetHeader>
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-4 pb-6">
          <div role="radiogroup" aria-label="How long" className="grid grid-cols-2 gap-2">
            {PIN_DURATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={pick === d.key}
                onClick={() => setPick(d.key)}
                className={cn(
                  "h-12 rounded-2xl border text-[0.95rem] font-semibold transition-colors",
                  pick === d.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-2",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <label
            className={cn(
              "flex h-12 items-center gap-3 rounded-2xl border px-4 transition-colors",
              pick === "date" ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <input
              type="radio"
              name="pin-length"
              checked={pick === "date"}
              onChange={() => setPick("date")}
              className="sr-only"
            />
            <CalendarDays className={cn("size-5 shrink-0", pick === "date" ? "text-primary" : "text-muted")} />
            <span className={cn("text-[0.95rem] font-semibold", pick === "date" && "text-primary")}>Until</span>
            <input
              type="date"
              value={date}
              min={today}
              max={addDays(today, MAX_PIN_DAYS)}
              onChange={(e) => {
                setDate(e.target.value);
                setPick("date");
              }}
              onFocus={() => setPick("date")}
              aria-label="Last day pinned"
              className="min-w-0 flex-1 bg-transparent text-right text-[0.95rem] font-semibold outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={pending || (pick === "date" && !date)}
            className="bg-primary text-primary-fg flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Pin className="size-4.5" />
            {pending ? "Pinning…" : changing ? "Save" : "Pin it"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
