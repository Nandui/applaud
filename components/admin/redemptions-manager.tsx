"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, MessageSquare, MessageSquarePlus, Play, X } from "lucide-react";
import {
  approveRedemption,
  fulfilRedemption,
  cancelRedemption,
  setRedemptionNote,
  type ActionResult,
} from "@/lib/rewards/actions";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClaimStatusBadge } from "@/components/rewards/claim-card";
import { claimStatusLabel } from "@/lib/fulfilment";
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
  /** When it was promised by (ms), for sorting; null when the reward has no fulfilment time. */
  expectedAt: number | null;
  expectedLabel: string | null;
  overdue: boolean;
  staffNote: string | null;
};

const STATUS_TABS = ["requested", "approved", "fulfilled", "cancelled", "all"] as const;

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
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-muted text-xs">
          {row.fulfilledByName ? `by ${row.fulfilledByName}` : "—"}
        </span>
        <NoteButton row={row} />
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      <NoteButton row={row} />
      {row.status === "requested" && (
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(approveRedemption, "Marked in progress")}
        >
          <Play className="size-3.5" /> In progress
        </Button>
      )}
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(fulfilRedemption, "Marked fulfilled")}
      >
        <Check className="size-3.5" /> Fulfilled
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        className="text-danger hover:text-danger"
        aria-label="Cancel and refund"
        title="Cancel and refund"
        onClick={() => run(cancelRedemption, "Cancelled & refunded")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

/** A message the person sees on their claim in My rewards. */
function NoteButton({ row }: { row: RedemptionRow }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(row.staffNote ?? "");
  const [pending, start] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("staffNote", note);
    start(async () => {
      const res = await setRedemptionNote(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        aria-label={row.staffNote ? "Edit note to employee" : "Add note to employee"}
        title={row.staffNote ?? "Add a note for the employee"}
        className={cn(row.staffNote && "text-primary hover:text-primary")}
        onClick={() => {
          setNote(row.staffNote ?? "");
          setOpen(true);
        }}
      >
        {row.staffNote ? <MessageSquare className="size-3.5" /> : <MessageSquarePlus className="size-3.5" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note to {row.userName}</DialogTitle>
            <DialogDescription>
              {`Shown on their ${row.rewardName} claim in My rewards, e.g. where to collect it or why it's taking longer.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Collect it from reception after 2pm."
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
      cell: ({ row }) => <ClaimStatusBadge status={row.original.status} />,
    },
    { accessorKey: "createdAtLabel", header: "Requested", enableSorting: false },
    {
      accessorKey: "expectedAt",
      header: "Due",
      cell: ({ row }) =>
        row.original.expectedLabel === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span
            data-numeric
            className={cn(
              "whitespace-nowrap",
              row.original.overdue && "text-danger font-semibold",
              (row.original.status === "fulfilled" || row.original.status === "cancelled") && "text-muted",
            )}
          >
            {row.original.expectedLabel}
            {row.original.overdue ? " · late" : ""}
          </span>
        ),
    },
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
              "rounded-full px-3 py-1 text-sm transition-colors",
              tab === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted hover:text-foreground",
            )}
          >
            {s === "all" ? "All" : claimStatusLabel(s)}
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
