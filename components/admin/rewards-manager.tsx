"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useActionState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import {
  saveReward,
  setRewardActive,
  type ActionResult,
} from "@/lib/rewards/actions";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

export type RewardRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  pointsCost: number;
  stock: number | null;
  siteId: string | null;
  active: boolean;
};

type SiteOption = { id: string; name: string };

const ALL_SITES = "__all__";

function RewardFormDialog({
  open,
  onOpenChange,
  editing,
  sites,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: RewardRow | null;
  sites: SiteOption[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(saveReward, undefined);

  const [siteId, setSiteId] = useState(editing?.siteId ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit reward" : "New reward"}</DialogTitle>
          <DialogDescription>
            Internal perks staff can redeem with their points.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="active" value={String(active)} />

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={editing?.description ?? ""}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                defaultValue={editing?.category ?? ""}
                placeholder="e.g. Merch"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pointsCost">Points cost</Label>
              <Input
                id="pointsCost"
                name="pointsCost"
                type="number"
                min={0}
                defaultValue={editing?.pointsCost ?? 0}
                className="font-mono"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={editing?.stock ?? ""}
                placeholder="Unlimited"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Available at</Label>
              <Select
                value={siteId === "" ? ALL_SITES : siteId}
                onValueChange={(v) => setSiteId(v === ALL_SITES ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SITES}>All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="active-switch">Active</Label>
            <Switch
              id="active-switch"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create reward"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActiveToggle({ row }: { row: RewardRow }) {
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
          const res = await setRewardActive(fd);
          if (!res.ok) toast.error(res.error);
        });
      }}
    />
  );
}

export function RewardsManager({
  rows,
  sites,
}: {
  rows: RewardRow[];
  sites: SiteOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RewardRow | null>(null);
  const siteName = (id: string | null) =>
    id ? (sites.find((s) => s.id === id)?.name ?? "—") : "All sites";

  const columns: ColumnDef<RewardRow>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => row.original.category ?? "—",
    },
    {
      accessorKey: "pointsCost",
      header: "Cost",
      cell: ({ row }) => (
        <span data-numeric>{formatNumber(row.original.pointsCost)}</span>
      ),
    },
    {
      accessorKey: "stock",
      header: "Stock",
      cell: ({ row }) =>
        row.original.stock === null ? (
          <span className="text-muted">∞</span>
        ) : (
          <span data-numeric>{formatNumber(row.original.stock)}</span>
        ),
    },
    {
      id: "scope",
      header: "Available at",
      cell: ({ row }) => siteName(row.original.siteId),
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
        <div className="flex justify-end">
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
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search rewards…"
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New reward
          </Button>
        }
      />
      <RewardFormDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        sites={sites}
      />
    </>
  );
}
