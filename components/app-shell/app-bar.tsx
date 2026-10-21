import { cn } from "@/lib/utils";

/**
 * Mobile app bar: a frosted, safe-area aware strip pinned to the top of the
 * screen (the iOS navigation bar / Instagram header pattern). Phones only —
 * desktop keeps the TopNav. Lives inside <main>, so it bleeds over main's
 * horizontal padding with -mx-4.
 */
export function AppBar({
  title,
  leading,
  trailing,
  className,
  children,
}: {
  title?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  /** Optional second row (segmented control, filter chips). */
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "glass pt-safe sticky top-0 z-30 -mx-4 mb-3 border-b border-black/[0.06] md:hidden",
        className,
      )}
    >
      <div className="flex h-12 items-center gap-1 px-4">
        {leading ? <div className="-ml-2 flex shrink-0 items-center">{leading}</div> : null}
        <div className="font-display min-w-0 flex-1 truncate text-[1.3rem] leading-none font-bold tracking-tight">
          {title}
        </div>
        {trailing ? (
          <div className="-mr-1.5 flex shrink-0 items-center gap-1">{trailing}</div>
        ) : null}
      </div>
      {children ? <div className="px-4 pb-2.5">{children}</div> : null}
    </header>
  );
}

/** A 44pt round icon button for the app bar (thumb-sized hit target). */
export const appBarIconClass =
  "text-foreground flex size-10 items-center justify-center rounded-full transition-transform active:scale-90 active:bg-black/5";
