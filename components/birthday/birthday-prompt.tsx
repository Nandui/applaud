"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BirthdayForm } from "@/components/birthday/birthday-form";
import {
  BIRTHDAY_CARD_SNOOZED_KEY,
  BIRTHDAY_CARD_SNOOZE_DAYS,
  formatBirthday,
} from "@/lib/birthday";
import { formatNumber } from "@/lib/format";

/** The add-your-birthday sheet, opened from Home or Edit profile. */
export function BirthdaySheet({
  open,
  onOpenChange,
  points,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: number;
  onSaved?: (iso: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-md">
        {open ? (
          <BirthdayForm
            points={points}
            onSkip={() => onOpenChange(false)}
            onSaved={(iso) => {
              onOpenChange(false);
              onSaved?.(iso);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Home card for people who use the app but haven't added a birthday (new
 * people are asked in the app tour). "Not now" hides it on this device for
 * BIRTHDAY_CARD_SNOOZE_DAYS days.
 */
export function BirthdayHomeCard({ points }: { points: number }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let snoozedAt = 0;
    try {
      snoozedAt = Number(localStorage.getItem(BIRTHDAY_CARD_SNOOZED_KEY) ?? 0);
    } catch {}
    const ms = BIRTHDAY_CARD_SNOOZE_DAYS * 86_400_000;
    // Reading the device's snooze can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!snoozedAt || Date.now() - snoozedAt > ms) setVisible(true);
  }, []);

  if (!visible) return null;

  const snooze = () => {
    try {
      localStorage.setItem(BIRTHDAY_CARD_SNOOZED_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  return (
    <>
      <div className="border-border border-b py-3">
        <div className="bg-primary/8 ring-primary/15 relative flex items-center gap-3 rounded-2xl p-3 pr-10 ring-1">
          <span className="bg-surface flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm" aria-hidden>
            🎂
          </span>
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
            <span className="block text-[0.95rem] font-bold">Add your birthday</span>
            <span className="text-muted block text-sm leading-snug">
              {points > 0 ? (
                <>
                  Get <b className="text-foreground">{formatNumber(points)} points</b> on your birthday, every
                  year.
                </>
              ) : (
                "So the team can celebrate you on the day."
              )}
            </span>
            <span className="text-primary mt-1 inline-flex items-center text-sm font-semibold">
              Add it <ChevronRight className="size-4" />
            </span>
          </button>
          <button
            type="button"
            onClick={snooze}
            aria-label="Not now"
            className="text-muted hover:text-foreground absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full"
          >
            <X className="size-4.5" />
          </button>
        </div>
      </div>
      <BirthdaySheet
        open={open}
        onOpenChange={setOpen}
        points={points}
        onSaved={() => {
          setVisible(false);
          router.refresh();
        }}
      />
    </>
  );
}

/** The Birthday row on Edit profile: add it once, then it's locked. */
export function BirthdayProfileRow({
  birthday: initial,
  points,
}: {
  birthday: string | null;
  points: number;
}) {
  const [birthday, setBirthday] = useState(initial);
  const [open, setOpen] = useState(false);

  if (birthday) {
    return (
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 py-3">Birthday</span>
        <span className="flex-1 py-3">{formatBirthday(birthday)}</span>
        <Lock className="text-muted size-4" aria-label="Locked" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 py-3 text-left active:opacity-60"
      >
        <span className="w-28 shrink-0">Birthday</span>
        <span className="text-primary flex-1 truncate font-semibold">
          Add{points > 0 ? ` · ✦ ${formatNumber(points)} on the day` : ""}
        </span>
        <ChevronRight className="text-muted size-4.5" />
      </button>
      <BirthdaySheet open={open} onOpenChange={setOpen} points={points} onSaved={setBirthday} />
    </>
  );
}
