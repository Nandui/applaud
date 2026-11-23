"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Cake,
  ChevronLeft,
  Gift,
  Heart,
  House,
  Menu,
  MessageCircle,
  PackageOpen,
  ShoppingBag,
  Sparkles,
  SquarePlus,
  Trophy,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Wordmark } from "@/components/app-shell/brand";
import { Confetti } from "@/components/fx/confetti";
import { BirthdayForm } from "@/components/birthday/birthday-form";
import { finishTour } from "@/lib/onboarding-actions";
import { TOUR_DISMISSED_KEY, WELCOME_POINTS } from "@/lib/onboarding";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type TourContext = { openTour: () => void };
const Ctx = createContext<TourContext>({ openTour: () => {} });

/** Open the app tour from anywhere inside the app layout (e.g. the ☰ menu). */
export function useTour() {
  return useContext(Ctx);
}

/**
 * The app tour. Opens by itself for someone who hasn't finished it yet (their
 * first sign-in); finishing it pays the one-off welcome points. Closing it
 * puts it off until their next visit. Anyone can replay it from the ☰ menu on
 * their profile, which pays nothing.
 */
export function TourProvider({
  userId,
  onboarded,
  firstName,
  allowance,
  askBirthday,
  birthdayPoints,
  children,
}: {
  /** "Not now" is remembered per person, so switching accounts (or a test
   *  account, or an admin restarting the tour) still opens it. */
  userId: string;
  onboarded: boolean;
  firstName: string;
  allowance: number;
  /** No birthday saved yet: the tour asks for it (lib/birthday.ts). */
  askBirthday: boolean;
  birthdayPoints: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState(onboarded);
  const dismissedKey = `${TOUR_DISMISSED_KEY}:${userId}`;

  // First visit: open once the page has painted, unless they closed it
  // earlier in this browser session.
  useEffect(() => {
    if (onboarded) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(dismissedKey) === "1";
    } catch {}
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [onboarded, dismissedKey]);

  const openTour = useCallback(() => {
    setReplay(onboarded);
    setOpen(true);
  }, [onboarded]);

  const close = useCallback(
    (finished: boolean) => {
      setOpen(false);
      if (!finished && !onboarded) {
        try {
          sessionStorage.setItem(dismissedKey, "1");
        } catch {}
      }
    },
    [onboarded, dismissedKey],
  );

  return (
    <Ctx.Provider value={{ openTour }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close(false))}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden sm:max-w-md sm:p-0">
          {open ? (
            <Tour
              replay={replay}
              firstName={firstName}
              allowance={allowance}
              askBirthday={askBirthday}
              birthdayPoints={birthdayPoints}
              onClose={close}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

type Step = {
  key: string;
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  visual: React.ReactNode;
};

/** The birthday step draws itself (BirthdayForm) and has its own buttons. */
const BIRTHDAY_STEP: Step = { key: "birthday", icon: Cake, title: "", body: null, visual: null };

function steps(firstName: string, allowance: number, replay: boolean, askBirthday: boolean): Step[] {
  return [
    {
      key: "welcome",
      icon: Sparkles,
      title: replay ? "A quick tour" : `Welcome, ${firstName}!`,
      body: replay ? (
        "Here's everything you can do in the app, in under a minute."
      ) : (
        <>
          This is where the team says thanks. Take the 1-minute tour and get{" "}
          <b className="text-foreground">{WELCOME_POINTS} points</b> to spend.
        </>
      ),
      visual: <WelcomeVisual replay={replay} />,
    },
    ...(askBirthday ? [BIRTHDAY_STEP] : []),
    {
      key: "feed",
      icon: House,
      title: "Your Home feed",
      body: "Recognitions and posts from the whole team. Tap the heart to like, press and hold it for other reactions, and comment to join in.",
      visual: <FeedVisual />,
    },
    {
      key: "recognize",
      icon: SquarePlus,
      title: "Recognize a teammate",
      body: (
        <>
          Tap <b className="text-foreground">Send</b>, pick who you&apos;re thanking and the value they
          showed
          {allowance > 0 ? (
            <>
              , then add points. You get{" "}
              <b className="text-foreground">{formatNumber(allowance)} points</b> to give every month.
              They reset on the 1st, so give them away.
            </>
          ) : (
            <>. Your recognitions don&apos;t carry points, but they still go in the feed for everyone to see.</>
          )}
        </>
      ),
      visual: <RecognizeVisual />,
    },
    {
      key: "wallet",
      icon: Wallet,
      title: "Points you get are yours",
      body: "Points people give you go into your wallet and never expire. Your balance is at the top of Home.",
      visual: <WalletVisual />,
    },
    {
      key: "rewards",
      icon: Gift,
      title: "Spend them on rewards",
      body: "The Store tab has real rewards. When you claim one, follow it in My rewards until it's ready for you.",
      visual: <RewardsVisual />,
    },
    {
      key: "shop",
      icon: ShoppingBag,
      title: "Make your profile yours",
      body: "The Profile shop has frames, banners and colour themes for a few points each. They show everywhere your name does.",
      visual: <ShopVisual />,
    },
    {
      key: "profile",
      icon: Trophy,
      title: "Your profile and Ranks",
      body: "Your profile keeps every recognition you get. Ranks shows this month's top people and the awards you can nominate for. Replay this tour from the menu on your profile.",
      visual: <ProfileVisual />,
    },
  ];
}

function Tour({
  replay,
  firstName,
  allowance,
  askBirthday,
  birthdayPoints,
  onClose,
}: {
  replay: boolean;
  firstName: string;
  allowance: number;
  askBirthday: boolean;
  birthdayPoints: number;
  onClose: (finished: boolean) => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  // Fixed when the tour opens, so saving the birthday (which refreshes the
  // page and drops askBirthday) doesn't shift the steps under the person.
  const [all] = useState(() => steps(firstName, allowance, replay, askBirthday));
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [claimed, setClaimed] = useState<{ awarded: number; balance: number } | null>(null);
  const [pending, start] = useTransition();
  const last = i === all.length - 1;
  const step = all[i];

  const go = (to: number) => {
    setDir(to > i ? 1 : -1);
    setI(to);
  };

  const finish = () => {
    if (replay) {
      onClose(true);
      return;
    }
    start(async () => {
      try {
        const res = await finishTour();
        setClaimed({ awarded: res.awarded, balance: res.balance });
        router.refresh();
      } catch {
        toast.error("Couldn't finish the tour. Try again.");
      }
    });
  };

  if (claimed) {
    return (
      <div className="flex min-h-[33rem] flex-col items-center justify-center px-1 pt-2 pb-1 text-center sm:min-h-0 sm:px-6 sm:pt-8 sm:pb-6">
        {claimed.awarded > 0 ? <Confetti /> : null}
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="bg-primary text-primary-fg flex h-16 items-center gap-2 rounded-full pr-6 pl-3 text-3xl font-black"
        >
          <span className="bg-primary-fg/20 flex size-11 items-center justify-center rounded-full text-xl">✦</span>
          <span data-numeric>+{claimed.awarded || WELCOME_POINTS}</span>
        </motion.div>
        <DialogTitle className="mt-6 text-2xl font-bold">
          {claimed.awarded > 0 ? "Points added!" : "You're all set"}
        </DialogTitle>
        <DialogDescription className="text-muted mt-2 max-w-xs text-[0.95rem] leading-relaxed">
          {claimed.awarded > 0 ? (
            <>
              Your wallet now has <b className="text-foreground">{formatNumber(claimed.balance)} points</b>.
              A frame or banner from the Profile shop is a good first buy.
            </>
          ) : (
            "You already got your welcome points earlier."
          )}
        </DialogDescription>
        <div className="mt-7 flex w-full flex-col gap-2">
          <Link
            href="/shop"
            onClick={() => onClose(true)}
            className="bg-primary text-primary-fg flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition-opacity active:opacity-80"
          >
            <Sparkles className="size-4.5" /> Open the Profile shop
          </Link>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="bg-surface-2 flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80"
          >
            Start exploring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between sm:px-4 sm:pt-4">
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-label="Back"
          className={cn(
            "text-muted hover:text-foreground -ml-2 flex size-9 items-center justify-center rounded-full transition-opacity sm:ml-0",
            i === 0 && "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="size-5.5" />
        </button>
        <div className="flex gap-1.5" aria-hidden>
          {all.map((s, n) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                n === i ? "bg-primary w-5" : n < i ? "bg-primary/40 w-1.5" : "bg-border w-1.5",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label={replay ? "Close" : "Not now"}
          className="text-muted hover:text-foreground -mr-2 flex size-9 items-center justify-center rounded-full sm:mr-0"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className={cn("relative min-h-[25.5rem] overflow-hidden sm:px-6", step.key === "birthday" && "sm:pb-6")}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={step.key}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: "easeOut" }}
            className="pt-3"
          >
            {step.key === "birthday" ? (
              <>
                <StepTag icon={step.icon} n={i + 1} of={all.length} />
                <div className="mt-3">
                  <BirthdayForm
                    tall
                    points={birthdayPoints}
                    skipLabel="Skip for now"
                    onSkip={() => go(i + 1)}
                    onSaved={() => {
                      router.refresh();
                      go(i + 1);
                    }}
                  />
                </div>
              </>
            ) : (
            <>
            <div className="bg-surface-2/70 relative flex h-44 items-center justify-center overflow-hidden rounded-2xl">
              {step.visual}
            </div>
            <StepTag icon={step.icon} n={i + 1} of={all.length} className="mt-5" />
            <DialogTitle className="mt-3 text-[1.4rem] leading-tight font-bold">{step.title}</DialogTitle>
            <DialogDescription className="text-muted mt-2 text-[0.95rem] leading-relaxed">
              {step.body}
            </DialogDescription>
            </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={cn("mt-5 flex flex-col gap-2 sm:px-6 sm:pb-6", step.key === "birthday" && "hidden")}>
        {last ? (
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            className="bg-primary text-primary-fg flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-60"
          >
            {replay ? "Done" : pending ? "Adding your points…" : `Finish and get ${WELCOME_POINTS} points`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(i + 1)}
            className="bg-primary text-primary-fg flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80"
          >
            {i === 0 ? (replay ? "Start" : "Show me around") : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}

function StepTag({
  icon: Icon,
  n,
  of,
  className,
}: {
  icon: LucideIcon;
  n: number;
  of: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-lg">
        <Icon className="size-4.5" strokeWidth={2.2} />
      </span>
      <span className="text-muted text-xs font-semibold tracking-wide uppercase">
        {n} of {of}
      </span>
    </div>
  );
}

/* ---------- Little drawings of the real screens, one per step ---------- */

function Bar({ className }: { className?: string }) {
  return <span className={cn("bg-border block h-2 rounded-full", className)} />;
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "bg-surface flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1 text-sm font-bold shadow-sm",
        className,
      )}
    >
      <span className="bg-primary text-primary-fg flex size-6 items-center justify-center rounded-full text-[0.65rem] font-black">
        ✦
      </span>
      {children}
    </span>
  );
}

function Face({ className, tone = "a" }: { className?: string; tone?: "a" | "b" | "c" }) {
  const bg = { a: "bg-primary/30", b: "bg-muted/35", c: "bg-muted/20" }[tone];
  return <span className={cn("block shrink-0 rounded-full", bg, className)} />;
}

function WelcomeVisual({ replay }: { replay: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Wordmark className="text-[2.6rem]" />
      {replay ? null : <Pill>+{WELCOME_POINTS} welcome points</Pill>}
    </div>
  );
}

function FeedVisual() {
  return (
    <div className="bg-surface w-56 rounded-xl p-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Face className="ring-primary size-7 ring-2 ring-offset-1 ring-offset-[var(--surface)]" />
        <div className="flex-1 space-y-1">
          <Bar className="bg-foreground/70 w-20" />
          <Bar className="w-14" />
        </div>
      </div>
      <div className="from-primary/25 to-primary/5 mt-2 h-16 rounded-lg bg-gradient-to-br" />
      <div className="bg-primary/10 text-primary mt-1.5 rounded-md px-2 py-1 text-[0.6rem] font-semibold">
        Recognised for a company value
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <Heart className="size-4.5 fill-[var(--danger)] text-[var(--danger)]" />
        <MessageCircle className="size-4.5" />
      </div>
    </div>
  );
}

function RecognizeVisual() {
  return (
    <div className="bg-surface w-56 rounded-xl p-3 shadow-sm">
      <div className="flex -space-x-2">
        <Face className="ring-surface size-8 ring-2" />
        <Face className="ring-surface size-8 ring-2" tone="b" />
        <Face className="ring-surface size-8 ring-2" tone="c" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="bg-primary text-primary-fg rounded-full px-2.5 py-1 text-[0.6rem] font-semibold">Teamwork</span>
        <span className="bg-surface-2 rounded-full px-2.5 py-1 text-[0.6rem] font-semibold">Above and beyond</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs font-bold" data-numeric>✦ 25</span>
        <span className="bg-primary text-primary-fg rounded-lg px-3 py-1 text-[0.65rem] font-semibold">Send</span>
      </div>
    </div>
  );
}

function WalletVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-surface flex w-56 items-center justify-between rounded-xl px-3 py-2.5 shadow-sm">
        <Wordmark className="text-[1.1rem]" />
        <Pill className="bg-surface-2 shadow-none">10</Pill>
      </div>
      <div className="bg-surface w-56 space-y-2 rounded-xl p-3 shadow-sm">
        {[25, 50].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <Face className="size-6" tone="b" />
            <Bar className="flex-1" />
            <span className="text-success text-xs font-bold" data-numeric>+{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardsVisual() {
  return (
    <div className="flex w-60 flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {["bg-primary/20", "bg-muted/25"].map((c) => (
          <div key={c} className="bg-surface rounded-xl p-2 shadow-sm">
            <div className={cn("flex h-12 items-center justify-center rounded-lg", c)}>
              <Gift className="text-foreground/60 size-5" />
            </div>
            <Bar className="mt-2 w-16" />
            <span className="mt-1.5 block text-[0.65rem] font-bold">✦ 500</span>
          </div>
        ))}
      </div>
      <div className="bg-surface flex items-center gap-2 rounded-xl px-2.5 py-2 shadow-sm">
        <PackageOpen className="text-primary size-4.5" />
        <span className="flex-1 text-[0.65rem] font-semibold">My rewards</span>
        <span className="bg-warning/15 text-warning rounded-full px-2 py-0.5 text-[0.6rem] font-bold">In progress</span>
      </div>
    </div>
  );
}

function ShopVisual() {
  return (
    <div className="bg-surface w-60 overflow-hidden rounded-xl shadow-sm">
      <div className="from-primary/60 via-primary/30 h-[4.5rem] bg-gradient-to-r to-[#ff8fc7]/50" />
      <div className="flex items-end gap-2 px-3 pb-3">
        <Face className="ring-primary -mt-6 size-12 ring-[3px] ring-offset-2 ring-offset-[var(--surface)]" tone="b" />
        <div className="flex-1 space-y-1 pb-1">
          <Bar className="bg-foreground/70 w-20" />
        </div>
        <Pill className="bg-surface-2 h-7 shadow-none">3</Pill>
      </div>
    </div>
  );
}

function ProfileVisual() {
  return (
    <div className="bg-surface w-60 overflow-hidden rounded-xl shadow-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <Bar className="bg-foreground/70 w-20" />
        <span className="bg-primary/12 text-primary ring-primary/40 flex size-7 items-center justify-center rounded-full ring-2">
          <Menu className="size-4" />
        </span>
      </div>
      <div className="bg-muted/20 h-12" />
      <div className="flex items-center gap-2 px-3 pb-3">
        <Face className="ring-surface -mt-5 size-11 ring-4" />
        <div className="mt-1 flex gap-3 text-[0.6rem] font-semibold">
          <span>
            <b data-numeric>12</b> received
          </span>
          <span>
            <b data-numeric>8</b> given
          </span>
        </div>
      </div>
    </div>
  );
}
