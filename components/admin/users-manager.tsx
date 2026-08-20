"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Pencil, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import {
  deleteUser,
  saveUser,
  setUserActive,
  type ActionResult,
} from "@/lib/admin/actions";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { DataTable } from "@/components/data-table";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
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

// Base UI's Select shows the trigger label from a value→label `items` map (it
// renders the raw value otherwise). Roles are fixed; sites/managers are built
// from props.
const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  manager: "Manager",
  admin: "Admin",
  operations: "Operations",
  ceo: "CEO",
};

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
  const [name, setName] = useState(editing?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(editing?.avatarUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFile(file: File) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Use a PNG, JPG, GIF, or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Picture must be 8MB or smaller.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const blob = await upload(`avatars/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/avatar/upload",
        contentType: file.type,
      });
      setAvatarUrl(blob.url);
    } catch {
      toast.error("Picture upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, onOpenChange]);

  const siteItems = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const managerItems: Record<string, string> = {
    [NONE]: "No manager",
    ...Object.fromEntries(
      managers.filter((m) => m.id !== editing?.id).map((m) => [m.id, m.name]),
    ),
  };

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
          <input type="hidden" name="avatarUrl" value={avatarUrl} />

          {/* Picture */}
          <div className="flex items-center gap-4">
            <UserAvatar
              name={name || "New user"}
              avatarUrl={avatarUrl || null}
              className="size-16 text-lg"
            />
            <div className="space-y-1.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      {avatarUrl ? "Change picture" : "Upload picture"}
                    </>
                  )}
                </Button>
                {avatarUrl && !uploadingAvatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatarUrl("")}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-muted text-xs">PNG, JPG, GIF, or WebP · max 8MB</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
              <Select value={role} onValueChange={setRole} items={ROLE_LABELS}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="ceo">CEO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId} items={siteItems}>
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
              items={managerItems}
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
            <Button type="submit" disabled={pending || uploadingAvatar}>
              {pending ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  onOpenChange,
}: {
  user: UserRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove user</DialogTitle>
          <DialogDescription>
            {user
              ? `${user.name} will be removed from ${user.siteName} and the people list. If they have recognition or points history, that history is kept and their record is archived instead of deleted. This can't be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!user) return;
              const fd = new FormData();
              fd.set("id", user.id);
              start(async () => {
                const res = await deleteUser(fd);
                if (res.ok) {
                  toast.success(res.message ?? "User removed.");
                  onOpenChange(false);
                } else toast.error(res.error);
              });
            }}
          >
            {pending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
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
  operations: "bg-success/15 text-success",
  ceo: "bg-warning/15 text-warning",
};

export function UsersManager({
  rows,
  sites,
  managers,
  currentUserId,
}: {
  rows: UserRow[];
  sites: Option[];
  managers: Option[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar
            name={row.original.name}
            avatarUrl={row.original.avatarUrl}
            className="size-8"
          />
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
          {row.original.id !== currentUserId && (
            <Button
              size="xs"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-3.5" /> Remove
            </Button>
          )}
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
      <DeleteUserDialog
        user={deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      />
    </>
  );
}
