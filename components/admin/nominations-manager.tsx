"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { NominationActions } from "@/components/awards/nomination-actions";
import { cn } from "@/lib/utils";

export type NominationRow = {
  id: string;
  status: string;
  programName: string;
  programPoints: number;
  nomineeId: string;
  nomineeName: string;
  nominatorName: string;
  justification: string;
  createdAtLabel: string;
  reviewedByName: string | null;
};

const STATUS_TABS = ["pending", "approved", "rejected", "all"] as const;

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-danger/10 text-danger",
};

export function NominationsManager({ rows }: { rows: NominationRow[] }) {
  const [tab, setTab] = useState<string>("pending");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const columns: ColumnDef<NominationRow>[] = [
    {
      accessorKey: "nomineeName",
      header: "Nominee",
      cell: ({ row }) => (
        <div className="max-w-xs">
          <Link
            href={`/profile/${row.original.nomineeId}`}
            className="hover:text-primary font-medium"
          >
            {row.original.nomineeName}
          </Link>
          <p className="text-muted text-xs">by {row.original.nominatorName}</p>
          <p className="text-muted truncate text-xs" title={row.original.justification}>
            {row.original.justification}
          </p>
        </div>
      ),
    },
    { accessorKey: "programName", header: "Program" },
    {
      accessorKey: "programPoints",
      header: "Points",
      cell: ({ row }) => (
        <span data-numeric>+{row.original.programPoints}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            STATUS_TONE[row.original.status] ?? "bg-secondary text-muted",
          )}
        >
          {row.original.status}
        </span>
      ),
    },
    { accessorKey: "createdAtLabel", header: "Submitted", enableSorting: false },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <NominationActions id={row.original.id} />
        ) : (
          <span className="text-muted text-xs">
            {row.original.reviewedByName ? `by ${row.original.reviewedByName}` : "—"}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full px-3 py-1 text-sm capitalize transition-colors",
              tab === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted hover:text-foreground",
            )}
          >
            {s}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search nominations…"
      />
    </div>
  );
}
