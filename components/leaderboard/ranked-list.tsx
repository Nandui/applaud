import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RankedRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  subtitle: string;
  primary: string;
  secondary?: string;
};

const RANK_TONE = [
  "bg-warning/15 text-warning", // 1
  "bg-muted/15 text-muted", // 2
  "bg-accent/15 text-accent", // 3
];

export function RankedList({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: RankedRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-muted text-xs">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">
            No data for this period.
          </p>
        ) : (
          <ol className="divide-border divide-y">
            {rows.map((row, i) => (
              <li key={row.id} className="flex items-center gap-3 py-2.5">
                <span
                  data-numeric
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    RANK_TONE[i] ?? "bg-secondary text-muted",
                  )}
                >
                  {i + 1}
                </span>
                <UserAvatar
                  name={row.name}
                  avatarUrl={row.avatarUrl}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${row.id}`}
                    className="hover:text-primary truncate text-sm font-medium"
                  >
                    {row.name}
                  </Link>
                  <p className="text-muted truncate text-xs">{row.subtitle}</p>
                </div>
                <div className="text-right">
                  <p data-numeric className="text-sm font-semibold">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="text-muted text-xs">{row.secondary}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
