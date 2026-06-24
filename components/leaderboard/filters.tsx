"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIODS, PERIOD_LABELS, type Period } from "@/lib/periods";

type SiteOption = { id: string; name: string };

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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: "site" | "period", value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (key === "site" && value === "all") sp.delete("site");
    else sp.set(key, value);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={site} onValueChange={(v) => update("site", v)}>
        <SelectTrigger className="w-40" size="sm">
          <SelectValue placeholder="All sites" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sites</SelectItem>
          {sites.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={period} onValueChange={(v) => update("period", v)}>
        <SelectTrigger className="w-40" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {PERIOD_LABELS[p as Period]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
