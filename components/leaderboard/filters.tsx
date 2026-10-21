"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { PERIODS, PERIOD_LABELS, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";

type SiteOption = { id: string; name: string };
export type Board = "received" | "given";

/** Build a leaderboard URL from the current params with one key changed. */
function useHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null) sp.delete(key);
    else sp.set(key, value);
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

/** Big text tabs (Duolingo league header): who is being ranked. */
export function BoardSwitch({ board }: { board: Board }) {
  const href = useHref();
  const tabs: { key: Board; label: string }[] = [
    { key: "received", label: "Most recognised" },
    { key: "given", label: "Top givers" },
  ];
  return (
    <div className="flex gap-5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={href("board", t.key === "received" ? null : t.key)}
          replace
          scroll={false}
          className={cn(
            "font-display relative text-[1.35rem] font-extrabold tracking-tight whitespace-nowrap transition-colors",
            board === t.key ? "text-foreground" : "text-muted/60",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Period chips + a site picker. The site picker is a real <select> styled as
 * a chip, so phones open their native wheel/list picker.
 */
export function LeaderboardFilters({
  sites,
  site,
  period,
}: {
  sites: SiteOption[];
  site: string;
  period: string;
}) {
  const router = useRouter();
  const href = useHref();

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={href("period", p)}
          replace
          scroll={false}
          className={cn(
            "flex h-8 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors",
            period === p ? "bg-lime text-lime-fg" : "bg-surface-2",
          )}
        >
          {PERIOD_LABELS[p as Period]}
        </Link>
      ))}
      <label
        className={cn(
          "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-3 text-sm font-semibold",
          site !== "all" ? "bg-lime text-lime-fg" : "bg-surface-2",
        )}
      >
        <MapPin className="size-3.5" />
        <span className="max-w-36 truncate">
          {site === "all" ? "All sites" : (sites.find((s) => s.id === site)?.name ?? "Site")}
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
        <select
          aria-label="Site"
          value={site}
          onChange={(e) =>
            router.replace(href("site", e.target.value === "all" ? null : e.target.value), {
              scroll: false,
            })
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
