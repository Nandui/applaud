import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

export type RankedRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  subtitle: string;
  primary: string;
  secondary?: string;
};

/** Podium order on screen: 2nd, 1st, 3rd. */
const PODIUM_ORDER = [1, 0, 2];
const MEDAL = [
  "from-amber-300 to-yellow-500", // gold
  "from-slate-200 to-slate-400", // silver
  "from-orange-300 to-amber-600", // bronze
];

/**
 * Leaderboard: a podium for the top three (biggest in the middle, crowned),
 * then a ranked list for everyone else.
 */
export function RankedList({
  rows,
  viewerId,
}: {
  rows: RankedRow[];
  viewerId?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted flex flex-col items-center gap-2 py-20 text-center">
        <span className="text-4xl">🏁</span>
        <p className="text-foreground font-display font-semibold">No one on the board yet</p>
        <p className="text-sm">Recognition in this period will show up here.</p>
      </div>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-3">
      <ol className="flex items-end justify-center gap-2 px-1 pt-6 pb-1" aria-label="Top three">
        {PODIUM_ORDER.filter((i) => podium[i]).map((i) => {
          const row = podium[i];
          const first = i === 0;
          return (
            <li key={row.id} className="flex w-1/3 max-w-36 flex-col items-center">
              <Link href={`/profile/${row.id}`} className="flex flex-col items-center">
                <span className="relative">
                  {first && (
                    <Crown
                      className="absolute -top-6 left-1/2 size-6 -translate-x-1/2 fill-amber-400 text-amber-500"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "block rounded-full bg-gradient-to-br p-[3px]",
                      MEDAL[i],
                    )}
                  >
                    <span className="bg-surface block rounded-full p-[2px]">
                      <UserAvatar
                        name={row.name}
                        avatarUrl={row.avatarUrl}
                        className={first ? "size-20 text-lg" : "size-16 text-base"}
                      />
                    </span>
                  </span>
                  <span
                    data-numeric
                    className={cn(
                      "ring-background absolute -bottom-2 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-2",
                      MEDAL[i],
                    )}
                  >
                    {i + 1}
                  </span>
                </span>
                <span className="mt-3.5 w-full truncate text-center text-sm font-semibold">
                  {row.name.split(" ")[0]}
                </span>
              </Link>
              <span data-numeric className="text-primary text-sm font-bold">
                {row.primary}
              </span>
              <div
                className={cn(
                  "from-surface mt-2 w-full rounded-t-2xl bg-gradient-to-b to-transparent",
                  first ? "h-20" : i === 1 ? "h-14" : "h-10",
                )}
              />
            </li>
          );
        })}
      </ol>

      {rest.length > 0 && (
        <ol className="bg-surface -mx-4 md:mx-0 md:rounded-2xl md:border" start={4}>
          {rest.map((row, idx) => (
            <li key={row.id}>
              <Link
                href={`/profile/${row.id}`}
                className={cn(
                  "active:bg-secondary flex items-center gap-3 px-4 py-2.5",
                  row.id === viewerId && "bg-primary/[0.06]",
                )}
              >
                <span data-numeric className="text-muted w-6 shrink-0 text-center text-sm font-semibold">
                  {idx + 4}
                </span>
                <UserAvatar name={row.name} avatarUrl={row.avatarUrl} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-semibold">
                    {row.name}
                    {row.id === viewerId && <span className="text-primary"> · You</span>}
                  </p>
                  <p className="text-muted truncate text-[0.8rem]">{row.subtitle}</p>
                </div>
                <div className="text-right">
                  <p data-numeric className="text-sm font-semibold">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="text-muted text-xs">{row.secondary}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
