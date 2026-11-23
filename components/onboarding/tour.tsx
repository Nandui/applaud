"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cake, Sparkles, X, type LucideIcon } from "lucide-react";
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
 *
 * After a welcome card (and the birthday question, for people who haven't
 * added one), the tour walks through the real app: it opens each page and
 * dims everything except the button or card it's talking about, on phones
 * (tab bar) and desktops (side rail) alike. Elements opt in with a
 * `data-tour="…"` attribute.
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
      {open ? (
        <Tour
          userId={userId}
          replay={replay}
          firstName={firstName}
          allowance={allowance}
          askBirthday={askBirthday}
          birthdayPoints={birthdayPoints}
          onClose={close}
        />
      ) : null}
    </Ctx.Provider>
  );
}

/* ---------------------------------- Steps --------------------------------- */

/** A card in the middle of the screen (welcome, birthday). */
type CenterStep = { kind: "center"; key: "welcome" | "birthday" };

/** A coach mark: open `route`, then point at the first visible `data-tour` target. */
type SpotStep = {
  kind: "spot";
  key: string;
  route: string;
  /** `data-tour` values, tried in order; the first one on screen wins. */
  targets: string[];
  title: string;
  body: React.ReactNode;
};

type Step = CenterStep | SpotStep;

const B = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;

function steps(userId: string, allowance: number, askBirthday: boolean): Step[] {
  return [
    { kind: "center", key: "welcome" },
    ...(askBirthday ? [{ kind: "center", key: "birthday" } as const] : []),
    {
      kind: "spot",
      key: "feed",
      route: "/",
      // An empty feed has no posts to point at, so fall back to the composer.
      targets: ["post-actions", "composer"],
      title: "Like and comment",
      body: (
        <>
          Home is where recognitions and posts from the whole team land. Tap the <B>heart</B> to like,
          hold it for more reactions, and tap the <B>bubble</B> to comment.
        </>
      ),
    },
    {
      kind: "spot",
      key: "post",
      route: "/",
      targets: ["composer"],
      title: "Share what's going on",
      body: "Tap here to write a post or add photos. It goes in everyone's Home feed.",
    },
    {
      kind: "spot",
      key: "recognize",
      route: "/",
      targets: ["nav-recognize"],
      title: "Recognize a teammate",
      body: (
        <>
          Tap here, pick who you&apos;re thanking and the value they showed
          {allowance > 0 ? (
            <>
              , then add points. You get <B>{formatNumber(allowance)} points</B> to give every month. They
              reset on the 1st, so give them away.
            </>
          ) : (
            <>. Your recognitions don&apos;t carry points, but everyone sees them in the feed.</>
          )}
        </>
      ),
    },
    {
      kind: "spot",
      key: "wallet",
      route: "/",
      targets: ["wallet"],
      title: "Your points",
      body: (
        <>
          Points people give you land here. Tap your balance to see where they came from. Points you
          collect <B>expire at the end of the year</B> (31 December), so spend them before then.
        </>
      ),
    },
    {
      kind: "spot",
      key: "rewards",
      route: "/rewards",
      targets: ["nav-store"],
      title: "Spend them on rewards",
      body: "Swap your points for real rewards here. A violet dot means something new has arrived.",
    },
    {
      kind: "spot",
      key: "claims",
      route: "/rewards",
      targets: ["tab-claims"],
      title: "Follow what you claimed",
      body: "After you claim a reward, track it in My rewards until it's ready for you.",
    },
    {
      kind: "spot",
      key: "shop",
      route: "/shop",
      targets: ["shop-look", "tab-shop"],
      title: "Make your profile yours",
      body: "This is your look. Tap a frame, banner or colour theme below to try it on, then buy it for a few points. It shows everywhere your name does.",
    },
    {
      kind: "spot",
      key: "ranks",
      route: "/leaderboard",
      targets: ["nav-ranks"],
      title: "Ranks and awards",
      body: "See this month's top people, and the awards you can nominate teammates for.",
    },
    {
      kind: "spot",
      key: "profile",
      route: `/profile/${userId}`,
      targets: ["profile-menu", "nav-profile"],
      title: "Your profile",
      body: "Every recognition you get stays on your profile. Edit it, check your wallet, and replay this tour from this menu.",
    },
  ];
}

/* ---------------------------------- Tour ---------------------------------- */

function Tour({
  userId,
  replay,
  firstName,
  allowance,
  askBirthday,
  birthdayPoints,
  onClose,
}: {
  userId: string;
  replay: boolean;
  firstName: string;
  allowance: number;
  askBirthday: boolean;
  birthdayPoints: number;
  onClose: (finished: boolean) => void;
}) {
  const router = useRouter();
  // Fixed when the tour opens, so saving the birthday (which refreshes the
  // page and drops askBirthday) doesn't shift the steps under the person.
  const [all] = useState(() => steps(userId, allowance, askBirthday));
  const [i, setI] = useState(0);
  const [claimed, setClaimed] = useState<{ awarded: number; balance: number } | null>(null);
  const [pending, start] = useTransition();
  const step = all[i];
  const last = i === all.length - 1;

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

  if (claimed || step.kind === "center") {
    return (
      <Dialog open onOpenChange={(o) => (o ? null : onClose(Boolean(claimed)))}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden sm:max-w-md sm:p-0">
          {claimed ? (
            <Claimed claimed={claimed} onClose={() => onClose(true)} />
          ) : step.key === "welcome" ? (
            <Welcome
              replay={replay}
              firstName={firstName}
              total={all.length}
              onNext={() => setI(1)}
              onClose={() => onClose(false)}
            />
          ) : (
            <div className="sm:px-6 sm:pt-4 sm:pb-6">
              <CardHeader icon={Cake} n={i + 1} of={all.length} replay={replay} onClose={() => onClose(false)} />
              <div className="mt-3">
                <BirthdayForm
                  tall
                  points={birthdayPoints}
                  skipLabel="Skip for now"
                  onSkip={() => setI(i + 1)}
                  onSaved={() => {
                    router.refresh();
                    setI(i + 1);
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Spotlight
      step={step}
      n={i + 1}
      of={all.length}
      last={last}
      replay={replay}
      pending={pending}
      onBack={() => setI(i - 1)}
      onNext={last ? finish : () => setI(i + 1)}
      onClose={() => onClose(false)}
    />
  );
}

function CardHeader({
  icon: Icon,
  n,
  of,
  replay,
  onClose,
}: {
  icon?: LucideIcon;
  n: number;
  of: number;
  replay: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? (
        <span className="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-lg">
          <Icon className="size-4.5" strokeWidth={2.2} />
        </span>
      ) : null}
      <span className="text-muted flex-1 text-xs font-semibold tracking-wide uppercase">
        {n} of {of}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label={replay ? "Close the tour" : "Not now"}
        className="text-muted hover:text-foreground -mr-2 flex size-9 items-center justify-center rounded-full"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

function Welcome({
  replay,
  firstName,
  total,
  onNext,
  onClose,
}: {
  replay: boolean;
  firstName: string;
  total: number;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col sm:px-6 sm:pt-4 sm:pb-6">
      <CardHeader n={1} of={total} replay={replay} onClose={onClose} />
      <div className="bg-surface-2/70 mt-3 flex h-44 flex-col items-center justify-center gap-4 rounded-2xl">
        <Wordmark className="text-[2.6rem]" />
        {replay ? null : <PointsPill>+{WELCOME_POINTS} welcome points</PointsPill>}
      </div>
      <DialogTitle className="mt-5 text-[1.4rem] leading-tight font-bold">
        {replay ? "A quick tour" : `Welcome, ${firstName}!`}
      </DialogTitle>
      <DialogDescription className="text-muted mt-2 text-[0.95rem] leading-relaxed">
        {replay ? (
          "We'll show you where everything is, right in the app. It takes under a minute."
        ) : (
          <>
            This is where the team says thanks. We&apos;ll show you where everything is, right in the app.
            Finish the tour and get <B>{WELCOME_POINTS} points</B> to spend.
          </>
        )}
      </DialogDescription>
      <button
        type="button"
        onClick={onNext}
        className="bg-primary text-primary-fg mt-6 flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80"
      >
        {replay ? "Start" : "Show me around"}
      </button>
    </div>
  );
}

function Claimed({
  claimed,
  onClose,
}: {
  claimed: { awarded: number; balance: number };
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
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
            Your wallet now has <B>{formatNumber(claimed.balance)} points</B>. A frame or banner from the
            Profile shop is a good first buy.
          </>
        ) : (
          "You already got your welcome points earlier."
        )}
      </DialogDescription>
      <div className="mt-7 flex w-full flex-col gap-2">
        <Link
          href="/shop"
          onClick={onClose}
          className="bg-primary text-primary-fg flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition-opacity active:opacity-80"
        >
          <Sparkles className="size-4.5" /> Open the Profile shop
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="bg-surface-2 flex h-12 items-center justify-center rounded-xl font-semibold transition-opacity active:opacity-80"
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}

function PointsPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1 text-sm font-bold shadow-sm">
      <span className="bg-primary text-primary-fg flex size-6 items-center justify-center rounded-full text-[0.65rem] font-black">
        ✦
      </span>
      {children}
    </span>
  );
}

/* -------------------------------- Spotlight ------------------------------- */

/** Space between the target and the bright ring around it. */
const PAD = 6;
/** Keep the card this far from the screen edges. */
const EDGE = 12;
/** Gap between the ring and the card. */
const GAP = 14;
/** How long to wait for a page to show the target before giving up on it. */
const FIND_TIMEOUT = 4000;

type Box = { top: number; left: number; width: number; height: number };

/** The first element tagged with one of `keys` that is actually on screen. */
function findTarget(keys: string[]): HTMLElement | null {
  for (const key of keys) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const sameBox = (a: Box | null, b: Box) =>
  a !== null &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

/**
 * Where the card goes: beside a target in the desktop side rail, otherwise
 * under it (or over it when it sits low, like the phone tab bar), centred on
 * it and kept on screen. Returns the arrow's offset along the card's edge too.
 */
function placeCard(t: Box, vw: number, vh: number, h: number) {
  const width = Math.min(vw - EDGE * 2, 360);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const cx = t.left + t.width / 2;
  const cy = t.top + t.height / 2;

  // Desktop side rail: the card sits to the right.
  if (vw >= 768 && t.left + t.width < 300) {
    const top = clamp(cy - h / 2, EDGE, vh - h - EDGE);
    return { top, left: t.left + t.width + PAD + GAP, width, side: "left" as const, arrow: clamp(cy - top, 20, h - 20) };
  }
  const left = clamp(cx - width / 2, EDGE, vw - width - EDGE);
  const arrow = clamp(cx - left, 22, width - 22);
  const below = t.top + t.height + PAD + GAP;
  const above = t.top - PAD - GAP - h;
  if (below + h <= vh - EDGE || (cy < vh / 2 && above < EDGE)) {
    return { top: Math.min(below, vh - h - EDGE), left, width, side: "top" as const, arrow };
  }
  return { top: Math.max(above, EDGE), left, width, side: "bottom" as const, arrow };
}

function Spotlight({
  step,
  n,
  of,
  last,
  replay,
  pending,
  onBack,
  onNext,
  onClose,
}: {
  step: SpotStep;
  n: number;
  of: number;
  last: boolean;
  replay: boolean;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const onRoute = pathname === step.route;
  // The last target found, and for which step: the ring glides from one
  // target to the next, but the card waits until it has found its own.
  const [found, setFound] = useState<{ key: string; box: Box } | null>(null);
  const [lostKey, setLostKey] = useState<string | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);

  // Open the step's page.
  useEffect(() => {
    if (!onRoute) router.push(step.route);
  }, [onRoute, step.route, router]);

  // Follow the target every frame: pages ease in, images load and people
  // scroll, and the ring has to stay on it through all of that.
  useEffect(() => {
    if (!onRoute) return;
    let raf = 0;
    let scrolled = false;
    const started = performance.now();
    const tick = () => {
      const el = findTarget(step.targets);
      if (el) {
        const r = el.getBoundingClientRect();
        if (!scrolled) {
          scrolled = true;
          // Off screen, or under the header or the tab bar: bring it to the middle.
          if (r.top < 64 || r.bottom > window.innerHeight - 72) {
            el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          }
        }
        const next = { top: r.top, left: r.left, width: r.width, height: r.height };
        setFound((prev) => (prev?.key === step.key && sameBox(prev.box, next) ? prev : { key: step.key, box: next }));
        setLostKey(null);
      } else if (performance.now() - started > FIND_TIMEOUT) {
        setLostKey(step.key);
      }
      setView((v) =>
        v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onRoute, step.key, step.targets, reduce]);

  const lost = lostKey === step.key;
  const ready = found?.key === step.key || lost;

  // Measure the card so it can sit right above a low target.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    setCardH(el.offsetHeight);
    return () => ro.disconnect();
  }, [ready, step.key]);

  // Focus the card for keyboards and screen readers once it shows.
  useEffect(() => {
    if (ready) cardRef.current?.focus({ preventScroll: true });
  }, [ready, step.key]);

  // Escape closes; arrow keys step through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !last) onNext();
      else if (e.key === "ArrowLeft" && n > 1) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onBack, last, n]);

  const spot = found && !lost ? found.box : null;
  const place = ready && spot && view.w ? placeCard(spot, view.w, view.h, cardH) : null;
  const titleId = `tour-${step.key}-title`;

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Catch taps on the page behind: the tour moves on with its own buttons. */}
      <div className="absolute inset-0" onClick={() => cardRef.current?.focus({ preventScroll: true })} />

      {/* The dim, with a hole cut around the target, and a bright ring round the hole. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {spot ? (
              <rect
                className={cn(!reduce && "transition-all duration-200 ease-out")}
                x={spot.left - PAD}
                y={spot.top - PAD}
                width={spot.width + PAD * 2}
                height={spot.height + PAD * 2}
                rx={16}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="black" fillOpacity={0.6} mask="url(#tour-hole)" />
      </svg>
      {spot ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-2xl",
            !reduce && "transition-[top,left,width,height] duration-200 ease-out",
          )}
          style={{
            top: spot.top - PAD,
            left: spot.left - PAD,
            width: spot.width + PAD * 2,
            height: spot.height + PAD * 2,
            boxShadow: "0 0 0 2px var(--primary), 0 0 0 4px rgb(255 255 255 / 0.5)",
          }}
        >
          {!reduce ? (
            <span className="border-primary absolute -inset-1 animate-ping rounded-2xl border-2 opacity-40 [animation-duration:1.6s]" />
          ) : null}
        </div>
      ) : null}

      <AnimatePresence>
        {ready ? (
          <motion.div
            key={step.key}
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: place?.side === "bottom" ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: "easeOut" }}
            className={cn(
              "bg-background border-border absolute rounded-2xl border p-4 shadow-2xl outline-none",
              !place && "inset-x-3 top-[30%] mx-auto max-w-[360px]",
            )}
            style={place ? { top: place.top, left: place.left, width: place.width } : undefined}
          >
            {place ? <Arrow side={place.side} at={place.arrow} /> : null}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden>
                {Array.from({ length: of }, (_, k) => (
                  <span
                    key={k}
                    className={cn(
                      "h-1 rounded-full",
                      k + 1 === n ? "bg-primary w-4" : k + 1 < n ? "bg-primary/40 w-1.5" : "bg-border w-1.5",
                    )}
                  />
                ))}
              </div>
              <span className="text-muted text-xs font-semibold tabular-nums">
                {n} of {of}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={replay ? "Close the tour" : "Not now"}
                className="text-muted hover:text-foreground -my-1 -mr-2 flex size-8 items-center justify-center rounded-full"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <h2 id={titleId} className="mt-2 text-[1.1rem] leading-tight font-bold">
              {step.title}
            </h2>
            <p className="text-muted mt-1.5 text-[0.9rem] leading-relaxed">{step.body}</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="text-muted hover:text-foreground h-10 rounded-xl px-3 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={pending}
                className="bg-primary text-primary-fg ml-auto flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-opacity active:opacity-80 disabled:opacity-60"
              >
                {!last
                  ? "Next"
                  : replay
                    ? "Done"
                    : pending
                      ? "Adding your points…"
                      : `Finish and get ${WELCOME_POINTS} points`}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The little point on the card's edge, aimed at the target. */
function Arrow({ side, at }: { side: "top" | "bottom" | "left"; at: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-background border-border absolute size-3 rotate-45",
        side === "top" && "-top-[7px] border-t border-l",
        side === "bottom" && "-bottom-[7px] border-r border-b",
        side === "left" && "-left-[7px] border-b border-l",
      )}
      style={side === "left" ? { top: at - 6 } : { left: at - 6 }}
    />
  );
}
