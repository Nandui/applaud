"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { saveValue, setValueActive, type ActionResult } from "@/lib/admin/actions";
import { VALUE_ICON_NAMES, valueIcon } from "@/lib/value-icons";
import { DataTable } from "@/components/data-table";
import { ValueChip } from "@/components/value-chip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export type ValueRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  active: boolean;
};

function ValueFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ValueRow | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(saveValue, undefined);
  const [icon, setIcon] = useState(editing?.icon ?? "Award");
  const [color, setColor] = useState(editing?.color ?? "#4f46e5");
  const [active, setActive] = useState(editing?.active ?? true);
  const Icon = valueIcon(icon);

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
          <DialogTitle>{editing ? "Edit value" : "New value"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
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
              rows={2}
              defaultValue={editing?.description ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex items-center gap-2">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ color, backgroundColor: `${color}1f` }}
                >
                  <Icon className="size-4.5" />
                </span>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {VALUE_ICON_NAMES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                name="order"
                type="number"
                defaultValue={editing?.order ?? 0}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color-input">Colour</Label>
            <div className="flex items-center gap-2">
              <input
                id="color-input"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="border-border size-9 rounded-md border"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="font-mono"
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

function ActiveToggle({ row }: { row: ValueRow }) {
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
          const res = await setValueActive(fd);
          if (!res.ok) toast.error(res.error);
        });
      }}
    />
  );
}

export function ValuesManager({ rows }: { rows: ValueRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ValueRow | null>(null);

  const columns: ColumnDef<ValueRow>[] = [
    {
      id: "preview",
      header: "Value",
      cell: ({ row }) => (
        <ValueChip
          value={{
            name: row.original.name,
            icon: row.original.icon,
            color: row.original.color,
          }}
        />
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted line-clamp-1 max-w-xs text-sm">
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "order",
      header: "Order",
      cell: ({ row }) => <span data-numeric>{row.original.order}</span>,
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
        searchPlaceholder="Search values…"
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New value
          </Button>
        }
      />
      <ValueFormDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
    </>
  );
}
