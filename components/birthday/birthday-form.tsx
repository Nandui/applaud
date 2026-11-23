"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { setMyBirthday } from "@/lib/birthday-actions";
import {
  MAX_AGE,
  MIN_AGE,
  MONTHS,
  daysInMonth,
  formatBirthday,
  isoFromParts,
} from "@/lib/birthday";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Add your birthday, in two steps: pick day, month and year, then a "double
 * check" screen, because once saved only an admin can change it. Renders its
 * own title and description, so it sits inside a Dialog (the app tour, or
 * the sheet opened from Home and Edit profile).
 */
export function BirthdayForm({
  points,
  onSaved,
  onSkip,
  skipLabel = "Not now",
  tall = false,
}: {
  /** Birthday points (0 when birthday points are switched off). */
  points: number;
  onSaved: (iso: string) => void;
  onSkip?: () => void;
  skipLabel?: string;
  /** The app tour's taller picture area. */
  tall?: boolean;
}) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = thisYear - MIN_AGE; y >= thisYear - MAX_AGE; y--) list.push(y);
    return list;
  }, [thisYear]);
  // Without a year yet, allow 29 February (a leap year decides it later).
  const maxDay = month ? daysInMonth(year ? Number(year) : 2000, Number(month)) : 31;
  const iso =
    day && month && year
      ? isoFromParts({ day: Number(day), month: Number(month), year: Number(year) })
      : null;

  const save = () => {
    if (!iso) return;
    setError(null);
    start(async () => {
      try {
        const res = await setMyBirthday(iso);
        if (res.ok) {
          toast.success("Birthday saved 🎂");
          onSaved(res.birthday);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Couldn't save your birthday. Try again.");
      }
    });
  };

  if (confirming && iso) {
    return (
      <div className="flex flex-col">
        <div
          className={cn(
            "bg-surface-2/70 flex flex-col items-center justify-center gap-1 rounded-2xl px-4 text-center",
            tall ? "h-44" : "h-36",
          )}
        >
          <span className="text-4xl" aria-hidden>
            🎂
          </span>
          <span className="mt-1 text-2xl font-black" data-numeric>
            {formatBirthday(iso)}
          </span>
        </div>
        <DialogTitle className="mt-5 text-[1.4rem] leading-tight font-bold">Is this right?</DialogTitle>
        <DialogDescription className="text-muted mt-2 text-[0.95rem] leading-relaxed">
          Double-check the day, month and year.
        </DialogDescription>
        <div className="bg-warning/12 text-foreground mt-4 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug">
          <Lock className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            <b>You can&apos;t change your birthday after you save it.</b>{" "}
            If it&apos;s ever wrong, only an admin can fix it.
          </span>
        </div>
        {error ? <p className="text-danger mt-3 text-sm font-medium">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="bg-primary text-primary-fg flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Yes, save my birthday"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            disabled={pending}
            className="bg-surface-2 flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80"
          >
            No, change it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "bg-surface-2/70 flex flex-col items-center justify-center gap-3 rounded-2xl",
          tall ? "h-44" : "h-36",
        )}
      >
        <span className="text-5xl" aria-hidden>
          🎂
        </span>
        {points > 0 ? (
          <span className="bg-surface flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1 text-sm font-bold shadow-sm">
            <span className="bg-primary text-primary-fg flex size-6 items-center justify-center rounded-full text-[0.65rem] font-black">
              ✦
            </span>
            +{formatNumber(points)} on your birthday
          </span>
        ) : null}
      </div>
      <DialogTitle className="mt-5 text-[1.4rem] leading-tight font-bold">When&apos;s your birthday?</DialogTitle>
      <DialogDescription className="text-muted mt-2 text-[0.95rem] leading-relaxed">
        {points > 0 ? (
          <>
            Add it and you&apos;ll get <b className="text-foreground">{formatNumber(points)} points</b> on
            your birthday, every year.
          </>
        ) : (
          "Add it so the team can celebrate you on the day."
        )}{" "}
        Only admins see the year.
      </DialogDescription>

      <div className="mt-4 grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
        <Picker label="Day" value={day} onChange={setDay}>
          {Array.from({ length: maxDay }, (_, n) => n + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Picker>
        <Picker
          label="Month"
          value={month}
          onChange={(m) => {
            setMonth(m);
            const max = daysInMonth(year ? Number(year) : 2000, Number(m));
            if (Number(day) > max) setDay("");
          }}
        >
          {MONTHS.map((name, n) => (
            <option key={name} value={n + 1}>
              {name}
            </option>
          ))}
        </Picker>
        <Picker
          label="Year"
          value={year}
          onChange={(y) => {
            setYear(y);
            if (month && Number(day) > daysInMonth(Number(y), Number(month))) setDay("");
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Picker>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!iso}
          className="bg-primary text-primary-fg flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Continue
        </button>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-muted hover:text-foreground flex h-10 items-center justify-center rounded-xl text-sm font-semibold"
          >
            {skipLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="text-muted mb-1 block px-1 text-xs font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "bg-surface-2 focus-visible:ring-primary h-12 w-full appearance-none rounded-xl pr-8 pl-3 text-[0.95rem] font-semibold outline-none focus-visible:ring-2",
          !value && "text-muted",
        )}
      >
        <option value="" disabled>
          {label}
        </option>
        {children}
      </select>
      <ChevronDown className="text-muted pointer-events-none absolute right-2.5 bottom-3.5 size-4.5" />
    </label>
  );
}
