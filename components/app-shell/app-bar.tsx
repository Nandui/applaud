import { cn } from "@/lib/utils";

/**
 * Screen header: a frosted, safe-area aware strip pinned to the top of the
 * content column (iOS navigation bar / Threads header). Lives inside <main>,
 * so on phones it bleeds over main's horizontal padding with -mx-4.
 */
export function AppBar({
  title,
  leading,
  trailing,
  className,
  children,
  tabs,
  center = false,
}: {
  title?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  /** Optional second row (segmented control, filter chips). */
  children?: React.ReactNode;
  /** A TabLinks row, flush with the bar's bottom edge. */
  tabs?: React.ReactNode;
  /** Centre the title between leading/trailing (modal-style screens). */
  center?: boolean;
}) {
  return (
    <header
      className={cn(
        "glass pt-safe sticky top-0 z-30 -mx-4 mb-3 md:mx-0",
        className,
      )}
    >
      <div className="relative flex h-14 items-center gap-1 px-4">
        {leading ? <div className="-ml-2 flex shrink-0 items-center">{leading}</div> : null}
        <div
          className={cn(
            "min-w-0 flex-1 truncate text-[1.4rem] leading-none font-bold tracking-[-0.02em]",
            center &&
              "pointer-events-none absolute inset-x-16 text-center text-[1.05rem] font-semibold tracking-tight",
          )}
        >
          {title}
        </div>
        {center ? <div className="flex-1" /> : null}
        {trailing ? (
          <div className="-mr-1.5 flex shrink-0 items-center gap-1">{trailing}</div>
        ) : null}
      </div>
      {children ? <div className="px-4 pb-3">{children}</div> : null}
      {tabs}
    </header>
  );
}

/** A 40px round icon button for the app bar (thumb-sized hit target). */
export const appBarIconClass =
  "text-foreground flex size-10 items-center justify-center rounded-full transition-transform active:scale-90 hover:bg-surface-2";
