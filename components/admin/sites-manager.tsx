"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteSite,
  saveSite,
  setSiteActive,
  type ActionResult,
} from "@/lib/admin/actions";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SiteRow = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  active: boolean;
  userCount: number;
};

function SiteFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: SiteRow | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(saveSite, undefined);
  const [active, setActive] = useState(editing?.active ?? true);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit site" : "New site"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="active" value={String(active)} />

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                defaultValue={editing?.code ?? ""}
                placeholder="MAH"
                className="font-mono uppercase"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={editing?.timezone ?? "Europe/Dublin"}
              />
            </div>
          </div>
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="active-switch">Active</Label>
            <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSiteDialog({
  site,
  onOpenChange,
}: {
  site: SiteRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, start] = useTransition();

  // The server re-checks this; the count here just explains the block up front.
  const blocked = !!site && site.userCount > 0;

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove site</DialogTitle>
          <DialogDescription>
            {site
              ? blocked
                ? `${site.name} (${site.code}) still has ${site.userCount} ${
                    site.userCount === 1 ? "person" : "people"
                  } assigned. Move them to another site first — removing a site never deletes its people.`
                : `${site.name} (${site.code}) will be deleted permanently. This can't be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          {!blocked && (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!site) return;
                const fd = new FormData();
                fd.set("id", site.id);
                start(async () => {
                  const res = await deleteSite(fd);
                  if (res.ok) {
                    toast.success(res.message ?? "Site removed.");
                    onOpenChange(false);
                  } else toast.error(res.error);
                });
              }}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveToggle({ row }: { row: SiteRow }) {
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={row.active}
      disabled={pending}
      onCheckedChange={(checked) => {
        const fd = new FormData();
        fd.set("id", row.id);
        fd.set("active", String(checked));
        start(async () => {
          const res = await setSiteActive(fd);
          if (!res.ok) toast.error(res.error);
        });
      }}
    />
  );
}

export function SitesManager({ rows }: { rows: SiteRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [deleting, setDeleting] = useState<SiteRow | null>(null);

  const columns: ColumnDef<SiteRow>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <Badge variant="secondary">{row.original.code}</Badge>,
    },
    { accessorKey: "timezone", header: "Timezone" },
    {
      accessorKey: "userCount",
      header: "People",
      cell: ({ row }) => <span data-numeric>{row.original.userCount}</span>,
    },
    {
      id: "active",
      header: "Active",
      enableSorting: false,
      cell: ({ row }) => <ActiveToggle row={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search sites…"
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New site
          </Button>
        }
      />
      <SiteFormDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
      <DeleteSiteDialog
        site={deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      />
    </>
  );
}
