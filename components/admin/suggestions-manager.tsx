"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ChevronUp, Megaphone, MessageSquare, PackageCheck, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ADMIN_STATUS_LABELS,
  KIND_TEXT,
  NOTE_MAX,
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
  /** The reward / profile item it became (Available ideas). */
  itemId: string | null;
  itemName: string | null;
  /** The suggester and the Chat space have already been told. */
  announced: boolean;
};

export type ItemOption = {
  id: string;
  name: string;
  imageUrl: string | null;
  active: boolean;
  detail: string | null;
  /** CSS background for banners and themes without a picture. */
  swatch: string | null;
};
export type NotifyState = { email: boolean; chat: boolean };

const KIND_FILTERS = ["all", "reward", "shop"] as const;
const STATUS_FILTERS = [...SUGGESTION_STATUSES, "all"] as const;

const STATUS_HINT: Record<SuggestionStatus, string> = {
  new: "Waiting for a decision. Staff can upvote it.",
  planned: "Staff see “Coming soon” and can keep upvoting. Nobody is notified yet.",
  added: "It's in Rewards or the shop. Voting closes and staff get a link to it.",
  declined: "Staff see “Not planned”, folded away at the bottom. Voting closes.",
};

/** Pick the reward or profile item the idea became, newest first. */
function ItemPicker({
  kind,
  items,
  value,
  onChange,
}: {
  kind: SuggestionKind;
  items: ItemOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Hidden items can't be picked, unless it's the one already linked.
  const shown = items.filter((i) => (i.active || i.id === value) && (!q || i.name.toLowerCase().includes(q))).slice(0, 40);
  const one = kind === "shop" ? "profile item" : "reward";

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Which {one} is it?</p>
        <Link
          href={kind === "shop" ? "/admin/store" : "/admin/rewards"}
          className="text-primary shrink-0 text-xs font-semibold hover:underline"
        >
          Add a new one
        </Link>
      </div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${kind === "shop" ? "the shop" : "rewards"}…`} />
      <ul className="border-border max-h-52 overflow-y-auto rounded-lg border" role="radiogroup" aria-label={`The ${one}`}>
        {shown.length === 0 ? (
          <li className="text-muted p-3 text-sm">
            Nothing matches. Add it in {kind === "shop" ? "Admin > Store" : "Admin > Rewards"} first, then come back.
          </li>
        ) : (
          shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="radio"
                aria-checked={value === item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors",
                  value === item.id ? "bg-primary/10" : "hover:bg-surface",
                )}
              >
                <span
                  className="bg-surface-2 size-9 shrink-0 overflow-hidden rounded-md"
                  style={!item.imageUrl && item.swatch ? { background: item.swatch } : undefined}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  {item.detail || !item.active ? (
                    <span className="text-muted block truncate text-xs">
                      {[item.detail, item.active ? null : "Hidden"].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                {value === item.id ? <Check className="text-primary size-4 shrink-0" /> : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Approve, decline or mark an idea available, plus the reply staff see on it. */
function RespondDialog({
  row,
  items,
  notify,
  open,
  onOpenChange,
}: {
  row: SuggestionRow;
  items: ItemOption[];
  notify: NotifyState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SuggestionStatus>(row.status);
  const [itemId, setItemId] = useState<string | null>(row.itemId);
  const [note, setNote] = useState(row.adminNote ?? "");
  const [pending, start] = useTransition();
  const needsItem = status === "added" && !itemId;
  const willAnnounce = status === "added" && !row.announced;
  const first = row.userName.split(/\s+/)[0];

  function save() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("status", status);
    fd.set("adminNote", note);
    if (status === "added" && itemId) fd.set("itemId", itemId);
    start(async () => {
      const res = await updateSuggestion(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const told = [notify.email ? `${first} gets an email` : null, notify.chat ? "the staff Chat space hears about it" : null].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
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
                {ADMIN_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs">{STATUS_HINT[status]}</p>
        </div>
        {status === "added" ? (
          <>
            <ItemPicker kind={row.kind} items={items} value={itemId} onChange={setItemId} />
            {willAnnounce ? (
              <p className="bg-primary/10 text-primary flex gap-2 rounded-lg px-3 py-2 text-sm">
                <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {told.length > 0
                    ? `When you save, ${told.join(" and ")}, saying it was ${first}'s idea.`
                    : "Idea emails and the Chat post are switched off in Admin > Settings, so nobody is notified."}
                </span>
              </p>
            ) : (
              <p className="text-muted text-xs">Everyone was already told about this one. Saving won&apos;t announce it again.</p>
            )}
          </>
        ) : null}
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
            placeholder={status === "declined" ? "Thanks, but it's not something we can offer." : "Great idea, it's coming in January."}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || needsItem} onClick={save}>
            {pending ? "Saving…" : willAnnounce && !needsItem ? "Save and announce" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ row, items, notify }: { row: SuggestionRow; items: ItemOption[]; notify: NotifyState }) {
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

  function approve() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("status", "planned");
    start(async () => {
      const res = await updateSuggestion(fd);
      if (res.ok) {
        toast.success("Approved. Staff now see it as Coming soon.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      {row.status === "new" ? (
        <Button size="xs" disabled={pending} onClick={approve} aria-label="Approve" title="Approve: staff see Coming soon">
          <Check className="size-3.5" /> <span className="hidden sm:inline">Approve</span>
        </Button>
      ) : null}
      {row.status === "planned" ? (
        <Button size="xs" onClick={() => setOpen(true)} aria-label="Mark available" title="Pick the item and tell everyone">
          <PackageCheck className="size-3.5" /> <span className="hidden sm:inline">It&apos;s available</span>
        </Button>
      ) : null}
      <Button size="xs" variant="outline" onClick={() => setOpen(true)} aria-label="Respond" title="Status, item and reply">
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
      {open ? (
        <RespondDialog
          row={row.status === "planned" ? { ...row, status: "added" } : row}
          items={items}
          notify={notify}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}

export function SuggestionsManager({
  rows,
  items,
  notify,
}: {
  rows: SuggestionRow[];
  items: Record<SuggestionKind, ItemOption[]>;
  notify: NotifyState;
}) {
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
          {row.original.itemName ? (
            <p className="text-success mt-0.5 text-xs font-medium break-words">Now: {row.original.itemName}</p>
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
      cell: ({ row }) => <IdeaStatusBadge status={row.original.status} label={ADMIN_STATUS_LABELS[row.original.status]} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <RowActions row={row.original} items={items[row.original.kind]} notify={notify} />,
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
            {s === "all" ? "All" : ADMIN_STATUS_LABELS[s]}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={filtered} searchPlaceholder="Search ideas…" />
    </div>
  );
}
