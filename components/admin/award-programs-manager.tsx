"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import {
  saveAwardProgram,
  setAwardProgramActive,
  type ActionResult,
} from "@/lib/awards/actions";
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

export type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  points: number;
  cadence: string | null;
  requiresApproval: boolean;
  active: boolean;
};

const ADHOC = "adhoc";

function ProgramFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ProgramRow | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(saveAwardProgram, undefined);
  const [cadence, setCadence] = useState(editing?.cadence ?? ADHOC);
  const [requiresApproval, setRequiresApproval] = useState(
    editing?.requiresApproval ?? true,
  );
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit program" : "New award program"}</DialogTitle>
          <DialogDescription>
            Nomination-based awards that grant points to winners.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="cadence" value={cadence} />
          <input
            type="hidden"
            name="requiresApproval"
            value={String(requiresApproval)}
          />
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
              <Label htmlFor="points">Points to winner</Label>
              <Input
                id="points"
                name="points"
                type="number"
                min={0}
                defaultValue={editing?.points ?? 0}
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={setCadence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ADHOC}>Ad hoc</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="approval-switch">Requires approval</Label>
            <Switch
              id="approval-switch"
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
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
              {pending ? "Saving…" : editing ? "Save changes" : "Create program"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActiveToggle({ row }: { row: ProgramRow }) {
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
          const res = await setAwardProgramActive(fd);
          if (!res.ok) toast.error(res.error);
        });
      }}
    />
  );
}

export function AwardProgramsManager({ rows }: { rows: ProgramRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramRow | null>(null);

  const columns: ColumnDef<ProgramRow>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "points",
      header: "Points",
      cell: ({ row }) => <span data-numeric>+{row.original.points}</span>,
    },
    {
      accessorKey: "cadence",
      header: "Cadence",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.cadence ?? "Ad hoc"}</span>
      ),
    },
    {
      accessorKey: "requiresApproval",
      header: "Approval",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.requiresApproval ? "Required" : "Instant"}
        </Badge>
      ),
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
        searchPlaceholder="Search programs…"
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New program
          </Button>
        }
      />
      <ProgramFormDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
    </>
  );
}
