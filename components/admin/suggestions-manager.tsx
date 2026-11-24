"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronUp, MessageSquare, Trash2 } from "lucide-react";
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
import { IdeaStatusBadge } from "@/components/ideas/ideas-board";
import { deleteSuggestion, updateSuggestion } from "@/lib/suggestion-actions";
import {
  KIND_TEXT,
  NOTE_MAX,
  STATUS_LABELS,
  SUGGESTION_STATUSES,
  type SuggestionKind,
  type SuggestionStatus,
} from "@/lib/suggestions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SuggestionRow = {
  id: string;
  kind: SuggestionKind;
  title: string;
  details: string | null;
  status: SuggestionStatus;
  adminNote: string | null;
  votes: number;
  createdAt: number;
  createdAtLabel: string;
  userId: string;
  userName: string;
};

const KIND_FILTERS = ["all", "reward", "shop"] as const;
const STATUS_FILTERS = [...SUGGESTION_STATUSES, "all"] as const;

/** Where an idea is up to, plus the reply staff see on it. */
function RespondDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SuggestionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SuggestionStatus>(row.status);
  const [note, setNote] = useState(row.adminNote ?? "");
  const [pending, start] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("status", status);
    fd.set("adminNote", note);
    start(async () => {
      const res = await updateSuggestion(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">{row.title}</DialogTitle>
          <DialogDescription>
            {`${KIND_TEXT[row.kind].tab} idea from ${row.userName}, ${formatNumber(row.votes)} upvote${row.votes === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>
        {row.details ? <p className="bg-surface rounded-lg p-3 text-sm whitespace-pre-line">{row.details}</p> : null}
        <div className="grid gap-1.5">
          <p className="text-sm font-semibold">Status</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Status">
            {SUGGESTION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "h-9 rounded-lg border text-sm font-semibold transition-colors",
                  status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs">
            Added and Not planned close voting. Not planned ideas stay listed for staff, folded away.
          </p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="admin-note" className="text-sm font-semibold">
            Reply <span className="text-muted font-normal">(optional, everyone sees it)</span>
          </label>
          <Textarea
            id="admin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder="Great idea, it's coming in January."
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ row }: { row: SuggestionRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm(`Delete "${row.title}"? Use this for spam or duplicates; it can't be undone.`)) return;
    const fd = new FormData();
    fd.set("id", row.id);
    start(async () => {
      const res = await deleteSuggestion(fd);
      if (res.ok) {
        toast.success(res.message ?? "Deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="xs" variant="outline" onClick={() => setOpen(true)} aria-label="Respond" title="Set status and reply">
        <MessageSquare className="size-3.5" /> <span className="hidden xl:inline">Respond</span>
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        className="text-danger hover:text-danger"
        aria-label="Delete idea"
        title="Delete idea"
        onClick={remove}
      >
        <Trash2 className="size-3.5" />
      </Button>
      {open ? <RespondDialog row={row} open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}

export function SuggestionsManager({ rows }: { rows: SuggestionRow[] }) {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("new");
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");

  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of ofKind) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [ofKind]);
  const filtered = useMemo(
    () => (status === "all" ? ofKind : ofKind.filter((r) => r.status === status)),
    [ofKind, status],
  );

  const columns: ColumnDef<SuggestionRow>[] = [
    {
      accessorKey: "votes",
      header: "Votes",
      cell: ({ row }) => (
        <span className="flex items-center gap-0.5 font-semibold" data-numeric>
          <ChevronUp className="text-muted size-4" aria-hidden />
          {formatNumber(row.original.votes)}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Idea",
      cell: ({ row }) => (
        <div className="max-w-xs min-w-44 whitespace-normal">
          <p className="font-medium break-words">{row.original.title}</p>
          <p className="text-muted text-xs">{KIND_TEXT[row.original.kind].tab}</p>
          {row.original.details ? (
            <p className="text-muted line-clamp-2 text-xs break-words">{row.original.details}</p>
          ) : null}
          {row.original.adminNote ? (
            <p className="text-primary mt-0.5 line-clamp-2 text-xs break-words">Reply: {row.original.adminNote}</p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "From",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <Link href={`/profile/${row.original.userId}`} className="hover:text-primary block font-medium">
            {row.original.userName}
          </Link>
          <span className="text-muted text-xs">{row.original.createdAtLabel}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <IdeaStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <RowActions row={row.original} />,
    },
  ];

  const chip = (on: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-sm transition-colors",
      on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>
            {k === "all" ? "Everything" : KIND_TEXT[k].tab}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === "all" ? "All" : STATUS_LABELS[s]}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={filtered} searchPlaceholder="Search ideas…" />
    </div>
  );
}
