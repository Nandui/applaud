"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { saveUser, setUserActive, type ActionResult } from "@/lib/admin/actions";
import { DataTable } from "@/components/data-table";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  role: string;
  siteId: string;
  siteName: string;
  managerId: string | null;
  managerName: string | null;
  hireDate: string | null; // yyyy-MM-dd
  birthday: string | null;
  active: boolean;
};

type Option = { id: string; name: string };

const NONE = "__none__";

function UserFormDialog({
  open,
  onOpenChange,
  editing,
  sites,
  managers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: UserRow | null;
  sites: Option[];
  managers: Option[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(saveUser, undefined);
  const [role, setRole] = useState(editing?.role ?? "staff");
  const [siteId, setSiteId] = useState(editing?.siteId ?? sites[0]?.id ?? "");
  const [managerId, setManagerId] = useState(editing?.managerId ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="managerId" value={managerId} />
          <input type="hidden" name="active" value={String(active)} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                defaultValue={editing?.jobTitle ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Manager</Label>
            <Select
              value={managerId === "" ? NONE : managerId}
              onValueChange={(v) => setManagerId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value={NONE}>No manager</SelectItem>
                {managers
                  .filter((m) => m.id !== editing?.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hireDate">Hire date</Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={editing?.hireDate ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                name="birthday"
                type="date"
                defaultValue={editing?.birthday ?? ""}
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

function ActiveToggle({ row }: { row: UserRow }) {
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
          const res = await setUserActive(fd);
          if (!res.ok) toast.error(res.error);
        });
      }}
    />
  );
}

const ROLE_TONE: Record<string, string> = {
  admin: "bg-primary/15 text-primary",
  manager: "bg-accent/15 text-accent",
  staff: "bg-secondary text-muted",
};

export function UsersManager({
  rows,
  sites,
  managers,
}: {
  rows: UserRow[];
  sites: Option[];
  managers: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar name={row.original.name} className="size-8" />
          <div className="min-w-0">
            <Link
              href={`/profile/${row.original.id}`}
              className="hover:text-primary block truncate font-medium"
            >
              {row.original.name}
            </Link>
            <p className="text-muted truncate text-xs">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_TONE[row.original.role] ?? ""}`}
        >
          {row.original.role}
        </span>
      ),
    },
    { accessorKey: "siteName", header: "Site" },
    {
      accessorKey: "managerName",
      header: "Manager",
      cell: ({ row }) => row.original.managerName ?? "—",
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
        searchPlaceholder="Search people…"
        pageSize={12}
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New user
          </Button>
        }
      />
      <UserFormDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        sites={sites}
        managers={managers}
      />
    </>
  );
}
