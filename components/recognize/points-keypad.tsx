"use client";

import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNumber, pts } from "@/lib/format";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"] as const;
const PRESETS = [10, 25, 50];

/**
 * Cash App-style points entry: a giant number over a keypad in a bottom sheet.
 * Points are per recipient and capped by what's left of the monthly giving
 * allowance; the cap is enforced again on the server.
 */
export function PointsKeypad({
  open,
  onOpenChange,
  value,
  onChange,
  max,
  people,
  remaining,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number;
  onChange: (n: number) => void;
  /** Most points each recipient can get with the allowance left. */
  max: number;
  people: number;
  remaining: number;
  total: number;
}) {
  function press(k: (typeof KEYS)[number]) {
    if (k === "C") return onChange(0);
    if (k === "⌫") return onChange(Math.floor(value / 10));
    const next = value * 10 + Number(k);
    onChange(Math.min(next, Math.max(0, max)));
  }
  const over = value * people > remaining;
  const left = Math.max(0, remaining - value * people);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SheetHeader className="px-0 pt-2 pb-0">
          <SheetTitle className="font-display text-xl">Add points</SheetTitle>
          <SheetDescription>
            {people > 1 ? `Each of the ${people} people gets this.` : "From your monthly giving allowance."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center py-5">
          <motion.p
            key={value}
            initial={{ scale: 0.92, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            data-numeric
            className={cn(
              "font-display text-7xl leading-none font-extrabold tracking-tight",
              value === 0 && "text-muted",
            )}
          >
            {formatNumber(value)}
            <span className="text-muted ml-1 text-2xl font-bold">pts</span>
          </motion.p>
          <p data-numeric className={cn("mt-3 text-sm", over ? "text-danger" : "text-muted")}>
            {people > 1 && value > 0 && `${pts(value * people)} total · `}
            {formatNumber(left)} of {formatNumber(total)} left this month
          </p>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={n > max}
              onClick={() => onChange(n)}
              className={cn(
                "h-10 rounded-full text-sm font-bold transition-colors disabled:opacity-30",
                value === n ? "bg-lime text-lime-fg" : "bg-surface-2",
              )}
            >
              <span data-numeric>{n}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={max <= 0}
            onClick={() => onChange(Math.max(0, max))}
            className={cn(
              "h-10 rounded-full text-sm font-bold transition-colors disabled:opacity-30",
              value === max && max > 0 ? "bg-lime text-lime-fg" : "bg-surface-2",
            )}
          >
            Max
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {KEYS.map((k) => (
            <motion.button
              key={k}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => press(k)}
              aria-label={k === "⌫" ? "Delete" : k === "C" ? "Clear" : k}
              className="hover:bg-surface-2 flex h-14 items-center justify-center rounded-2xl text-2xl font-semibold"
            >
              {k === "⌫" ? <Delete className="size-6" /> : k === "C" ? <span className="text-muted text-base">Clear</span> : k}
            </motion.button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="bg-foreground text-background mt-3 h-13 w-full rounded-full text-base font-bold transition-transform active:scale-[0.98]"
        >
          {value > 0 ? `Add ${pts(value)}` : "No points"}
        </button>
      </SheetContent>
    </Sheet>
  );
}
