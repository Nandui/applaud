"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Truck, X } from "lucide-react";
import {
  approveRedemption,
  fulfilRedemption,
  cancelRedemption,
  type ActionResult,
} from "@/lib/rewards/actions";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RedemptionRow = {
  id: string;
  status: string;
  pointsCost: number;
  createdAtLabel: string;
  userId: string;
  userName: string;
  rewardName: string;
  fulfilledByName: string | null;
};

const STATUS_TABS = ["requested", "approved", "fulfilled", "cancelled", "all"] as const;

const STATUS_TONE: Record<string, string> = {
  requested: "bg-warning/15 text-warning",
  approved: "bg-primary/15 text-primary",
  fulfilled: "bg-success/15 text-success",
  cancelled: "bg-danger/10 text-danger",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_TONE[status] ?? "bg-secondary text-muted",
      )}
    >
      {status}
    </span>
  );
}

function RowActions({ row }: { row: RedemptionRow }) {
  const [pending, start] = useTransition();

  function run(
    fn: (fd: FormData) => Promise<ActionResult>,
    fallback: string,
  ) {
    const fd = new FormData();
    fd.set("id", row.id);
    start(async () => {
      const res = await fn(fd);
      if (res.ok) toast.success(res.message ?? fallback);
      else toast.error(res.error);
    });
  }

  if (row.status === "fulfilled" || row.status === "cancelled") {
    return (
      <span className="text-muted text-xs">
        {row.fulfilledByName ? `by ${row.fulfilledByName}` : "—"}
      </span>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      {row.status === "requested" && (
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(approveRedemption, "Approved")}
        >
          <Check className="size-3.5" /> Approve
        </Button>
      )}
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(fulfilRedemption, "Fulfilled")}
      >
        <Truck className="size-3.5" /> Fulfil
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        className="text-danger hover:text-danger"
        onClick={() => run(cancelRedemption, "Cancelled & refunded")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

export function RedemptionsManager({ rows }: { rows: RedemptionRow[] }) {
  const [tab, setTab] = useState<string>("requested");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const columns: ColumnDef<RedemptionRow>[] = [
    {
      accessorKey: "userName",
      header: "Employee",
      cell: ({ row }) => (
        <Link
          href={`/profile/${row.original.userId}`}
          className="hover:text-primary font-medium"
        >
          {row.original.userName}
        </Link>
      ),
    },
    { accessorKey: "rewardName", header: "Reward" },
    {
      accessorKey: "pointsCost",
      header: "Cost",
      cell: ({ row }) => (
        <span data-numeric>{formatNumber(row.original.pointsCost)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: "createdAtLabel", header: "Requested", enableSorting: false },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <RowActions row={row.original} />,
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
        searchPlaceholder="Search redemptions…"
      />
    </div>
  );
}
