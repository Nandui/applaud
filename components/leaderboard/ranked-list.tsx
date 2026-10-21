import Link from "next/link";
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

const MEDAL = ["#fbbf24", "#cbd5e1", "#f59e0b"];
const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

/**
 * Duolingo league list: big rank numbers, medals for the top three, your own
 * row highlighted, and pinned to the bottom of the screen when you're further
 * down the list so you always know where you stand.
 */
export function RankedList({
  rows,
  viewerId,
  shown = 25,
}: {
  rows: RankedRow[];
  viewerId?: string;
  /** How many rows to list; your row still pins below if you're further down. */
  shown?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted flex flex-col items-center gap-2 py-20 text-center">
        <span className="text-4xl">🏁</span>
        <p className="text-foreground font-display font-bold">No one on the board yet</p>
        <p className="text-sm">Shout-outs in this period will show up here.</p>
      </div>
    );
  }

  const visible = rows.slice(0, shown);
  const myIndex = rows.findIndex((r) => r.id === viewerId);
  // Pin only when your row would be off the first screen.
  const pinMe = myIndex >= 5;

  return (
    <>
      <ol className="bg-surface overflow-hidden rounded-3xl">
        {visible.map((row, idx) => (
          <Row key={row.id} row={row} rank={idx + 1} me={row.id === viewerId} />
        ))}
      </ol>
      {pinMe && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-3 md:bottom-4">
          <ol className="border-lime/60 bg-surface overflow-hidden rounded-3xl border shadow-float">
            <Row row={rows[myIndex]} rank={myIndex + 1} me />
          </ol>
        </div>
      )}
    </>
  );
}

function Row({ row, rank, me }: { row: RankedRow; rank: number; me: boolean }) {
  const medal = rank <= 3 ? rank - 1 : -1;
  return (
    <li className="border-border border-b last:border-0">
      <Link
        href={`/profile/${row.id}`}
        className={cn(
          "active:bg-surface-2 flex items-center gap-3 px-4 py-3 transition-colors",
          me && "bg-lime/10",
        )}
      >
        <span
          data-numeric
          className={cn(
            "font-display w-7 shrink-0 text-center text-lg font-extrabold",
            medal < 0 && (me ? "text-lime-ink" : "text-muted"),
          )}
          style={medal >= 0 ? { color: MEDAL[medal] } : undefined}
        >
          {rank}
        </span>
        <span className="relative">
          <UserAvatar
            name={row.name}
            avatarUrl={row.avatarUrl}
            className={cn("size-11", medal >= 0 && "ring-2")}
          />
          {medal >= 0 && (
            <span className="absolute -right-1.5 -bottom-1 text-base leading-none">{MEDAL_EMOJI[medal]}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{row.name}</span>
            {me && (
              <span className="bg-lime text-lime-fg shrink-0 rounded-full px-1.5 py-px text-[10px] font-extrabold uppercase">
                You
              </span>
            )}
          </p>
          <p className="text-muted truncate text-[0.8rem]">{row.subtitle}</p>
        </div>
        <div className="text-right">
          <p data-numeric className="font-bold">
            {row.primary}
          </p>
          {row.secondary && <p className="text-muted text-xs">{row.secondary}</p>}
        </div>
      </Link>
    </li>
  );
}
