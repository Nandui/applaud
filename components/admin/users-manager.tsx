"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { uploadPresigned } from "@vercel/blob/client";
import { uploadErrorMessage } from "@/lib/upload-error";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Pencil, Plus, Trash2, Upload, Loader2, RotateCcw, FlaskConical } from "lucide-react";
import {
  deleteUser,
  removeTestAccounts,
  restartOnboarding,
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
import { ManagerPicker } from "@/components/admin/manager-picker";
import { POINTS_RANKS, RANK_LABELS, rankForRole } from "@/lib/ranks";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: string;
  pointsRank: string;
  siteId: string;
  siteName: string;
  managerIds: string[]; // zero or more people, name-sorted
  managerNames: string[];
  hireDate: string | null; // yyyy-MM-dd
  birthday: string | null;
  active: boolean;
  /** Created on their first Google sign-in; role and site not checked yet. */
  needsReview: boolean;
  /** Finished the first-sign-in app tour. */
  onboarded: boolean;
  /** Throwaway account from "Try as a brand-new person" (lib/test-accounts.ts). */
  isTest: boolean;
};

type Option = { id: string; name: string };

// Base UI's Select shows the trigger label from a value→label `items` map (it
// renders the raw value otherwise). App roles are fixed; sites/managers are
// built from props.
const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  manager: "Manager",
  admin: "Admin",
  operations: "Operations",
  ceo: "CEO",
};

// Beyond this many, the table shows a count instead of a list of names.
const MANAGER_NAMES_SHOWN = 2;

function managerSummary(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length <= MANAGER_NAMES_SHOWN) return names.join(", ");
  return `${names.length} managers`;
}

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
  const [pointsRank, setPointsRank] = useState(
    editing?.pointsRank ?? rankForRole(editing?.role ?? "staff"),
  );
  // Changing the app role moves the rank along with it while the rank still
  // matches the old role; a rank picked on purpose is left alone.
  function changeRole(next: string) {
    if (pointsRank === rankForRole(role)) setPointsRank(rankForRole(next));
    setRole(next);
  }
  const [siteId, setSiteId] = useState(editing?.siteId ?? sites[0]?.id ?? "");
  const [managerIds, setManagerIds] = useState<string[]>(
    editing?.managerIds ?? [],
  );
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
      const blob = await uploadPresigned(`avatars/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/avatar/upload",
        contentType: file.type,
      });
      setAvatarUrl(blob.url);
    } catch (error) {
      toast.error(uploadErrorMessage(error));
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
  // Nobody manages themselves, so the editing user is never an option.
  const managerOptions = managers.filter((m) => m.id !== editing?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
          {editing?.needsReview && (
            <DialogDescription>
              Created automatically when they first signed in with Google, as staff at{" "}
              {editing.siteName}. Check their app role and site, then save.
            </DialogDescription>
          )}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="pointsRank" value={pointsRank} />
          <input type="hidden" name="siteId" value={siteId} />
          {managerIds.map((m) => (
            <input key={m} type="hidden" name="managerIds" value={m} />
          ))}
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
              <Label htmlFor="jobTitle">Company role</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                placeholder="e.g. Duty Manager"
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
              <Label>App role</Label>
              <Select value={role} onValueChange={(v) => changeRole(String(v))} items={ROLE_LABELS}>
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
              <Label>Points rank</Label>
              <Select
                value={pointsRank}
                onValueChange={(v) => setPointsRank(String(v))}
                items={RANK_LABELS}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POINTS_RANKS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RANK_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted col-span-2 -mt-1.5 text-xs">
              The app role decides what they can open. The points rank decides how many points
              they can give each month (set in Economy). Backoffice gets none to give.
            </p>
            <div className="col-span-2 space-y-1.5">
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
            <Label>Managers</Label>
            <ManagerPicker
              options={managerOptions}
              value={managerIds}
              onChange={setManagerIds}
            />
            <p className="text-muted text-xs">
              Pick as many as apply — they can all review this person&apos;s
              nominations. Leave empty for no manager.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hireDate">Start date</Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={editing?.hireDate ?? ""}
              />
              <p className="text-muted text-xs">
                Earns their years-of-service medal at 1, 3, 5, 10, 15 and 20 years.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                name="birthday"
                type="date"
                defaultValue={editing?.birthday ?? ""}
              />
              <p className="text-muted text-xs">
                People add this once themselves and can&apos;t change it. Correct it here.
              </p>
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

/**
 * Puts someone back to a brand-new account's first sign-in (tour, welcome
 * points, New tags, optionally the birthday step). For testing; the welcome
 * points are taken back so they're never paid twice.
 */
function RestartOnboardingDialog({
  user,
  onOpenChange,
}: {
  user: UserRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [clearBirthday, setClearBirthday] = useState(true);

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart first sign-in</DialogTitle>
          <DialogDescription>
            {user
              ? `${user.name} gets the app tour again on their next page load, and the Store and Rewards show everything as New. Any welcome points they got are taken back now and paid again when they finish the tour, so they never get them twice. Use it to test the new-account experience.`
              : null}
          </DialogDescription>
        </DialogHeader>
        {user?.birthday ? (
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
            <span>
              <span className="block font-medium">Clear their birthday too</span>
              <span className="text-muted block text-xs">
                So the tour asks for it again. Saved now: {user.birthday}
              </span>
            </span>
            <Switch checked={clearBirthday} onCheckedChange={setClearBirthday} />
          </label>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!user) return;
              const fd = new FormData();
              fd.set("id", user.id);
              fd.set("clearBirthday", String(Boolean(user.birthday) && clearBirthday));
              start(async () => {
                const res = await restartOnboarding(fd);
                if (res.ok) {
                  toast.success(res.message ?? "Done.");
                  onOpenChange(false);
                } else toast.error(res.error);
              });
            }}
          >
            <RotateCcw className="size-4" />
            {pending ? "Restarting…" : "Restart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveTestAccountsButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      title="Removes every account made with “Try as a brand-new person”"
      onClick={() =>
        start(async () => {
          const res = await removeTestAccounts();
          if (res.ok) toast.success(res.message ?? "Done.");
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
      Remove {count} test {count === 1 ? "account" : "accounts"}
    </Button>
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
  manager: "bg-primary/15 text-primary",
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
  const [restarting, setRestarting] = useState<UserRow | null>(null);

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
            <div className="flex items-center gap-1.5">
              <Link
                href={`/profile/${row.original.id}`}
                className="hover:text-primary truncate font-medium"
              >
                {row.original.name}
              </Link>
              {row.original.needsReview && (
                <span
                  className="bg-primary/10 text-primary shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase"
                  title="Created on their first Google sign-in. Edit to check role and site."
                >
                  New
                </span>
              )}
              {row.original.isTest && (
                <span
                  className="bg-warning/15 text-warning shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase"
                  title="Throwaway account made with “Try as a brand-new person” on the sign-in page."
                >
                  Test
                </span>
              )}
            </div>
            <p className="text-muted truncate text-xs">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "jobTitle",
      header: "Company role",
      cell: ({ row }) => row.original.jobTitle ?? "—",
    },
    {
      accessorKey: "role",
      header: "App role",
      cell: ({ row }) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_TONE[row.original.role] ?? ""}`}
        >
          {ROLE_LABELS[row.original.role] ?? row.original.role}
        </span>
      ),
    },
    {
      accessorKey: "pointsRank",
      header: "Points rank",
      cell: ({ row }) => (
        <span className="text-sm">
          {RANK_LABELS[row.original.pointsRank as keyof typeof RANK_LABELS] ?? row.original.pointsRank}
        </span>
      ),
    },
    { accessorKey: "siteName", header: "Site" },
    {
      id: "managers",
      // Accessor (not just a cell) so search and sort still see every name
      // even when the cell shows a count.
      accessorFn: (row) => row.managerNames.join(", "),
      header: "Managers",
      cell: ({ row }) => (
        <span title={row.original.managerNames.join(", ")}>
          {managerSummary(row.original.managerNames)}
        </span>
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
            title="Restart first sign-in: app tour, welcome points, birthday"
            aria-label={`Restart first sign-in for ${row.original.name}`}
            onClick={() => setRestarting(row.original)}
          >
            <RotateCcw className="size-3.5" />
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

  const toReview = rows.filter((r) => r.needsReview && !r.isTest).length;
  const tests = rows.filter((r) => r.isTest).length;

  return (
    <>
      {toReview > 0 && (
        <p className="border-primary/30 bg-primary/5 mb-4 rounded-lg border px-3 py-2 text-sm">
          {toReview === 1
            ? "1 person joined"
            : `${toReview} people joined`}{" "}
          by signing in with Google and {toReview === 1 ? "is" : "are"} marked New. They
          start as staff at the busiest site; edit them to set the right app role and site.
        </p>
      )}
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search people…"
        pageSize={12}
        toolbar={
          <div className="flex flex-wrap gap-2">
            {tests > 0 && <RemoveTestAccountsButton count={tests} />}
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New user
            </Button>
          </div>
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
      <RestartOnboardingDialog
        key={restarting?.id ?? "none"}
        user={restarting}
        onOpenChange={(o) => {
          if (!o) setRestarting(null);
        }}
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
