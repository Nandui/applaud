import { cn } from "@/lib/utils";

const block = "bg-surface-2 animate-pulse rounded-md";

/**
 * What a tab shows the instant it is tapped, while the server prepares the
 * real screen: an empty app bar and a few placeholder rows in the same
 * column. Neutral on purpose, so it reads as "loading", never as content.
 */
export function ScreenSkeleton({ bar = true }: { bar?: boolean }) {
  return (
    <div className="mx-auto max-w-xl" aria-busy="true" aria-label="Loading">
      {bar ? (
        <div className="pt-safe -mx-4 mb-3 md:mx-0">
          <div className="flex h-14 items-center px-4">
            <div className={cn(block, "h-6 w-28")} />
          </div>
        </div>
      ) : null}
      <div className="space-y-6 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-surface-2 size-11 shrink-0 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className={cn(block, "h-3.5 w-2/5")} />
                <div className={cn(block, "h-3 w-1/4")} />
              </div>
            </div>
            <div className={cn(block, "-mx-4 aspect-[3/2] rounded-none md:mx-0 md:rounded-2xl")} />
          </div>
        ))}
      </div>
    </div>
  );
}
