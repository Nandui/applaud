"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useActionState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Upload } from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  saveReward,
  setRewardActive,
  reorderReward,
  type ActionResult,
} from "@/lib/rewards/actions";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
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
  imageUrl: string | null;
  category: string | null;
  pointsCost: number;
  stock: number | null;
  siteId: string | null;
  active: boolean;
  fulfilment: string;
  type: string;
  sortOrder: number;
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
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFile(file: File) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Use a PNG, JPG, GIF, or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Picture must be 8MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const blob = await upload(`rewards/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/reward/upload",
        contentType: file.type,
      });
      setImageUrl(blob.url);
    } catch {
      toast.error("Picture upload failed.");
    } finally {
      setUploading(false);
    }
  }

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
          <DialogTitle>{editing ? "Edit offering" : "New offering"}</DialogTitle>
          <DialogDescription>
            Staff will see this on the Rewards store. Hidden offerings stay in the catalogue but cannot be redeemed.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="imageUrl" value={imageUrl} />
          <input type="hidden" name="fulfilment" value="manual" />
          <input type="hidden" name="type" value="internal" />

          <div className="space-y-1.5">
            <Label>Image</Label>
            <div className="flex items-center gap-4">
              <div className="bg-secondary text-muted flex size-16 items-center justify-center overflow-hidden rounded-lg">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-xs">None</span>
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageFile(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        {imageUrl ? "Change image" : "Upload image"}
                      </>
                    )}
                  </Button>
                  {imageUrl && !uploading && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

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
              placeholder="What staff will see on the store"
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editing?.sortOrder ?? 0}
                className="font-mono"
              />
              <p className="text-muted text-xs">Lower numbers appear first on the store.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Fulfilment</Label>
              <Input value="Manual" disabled />
              <p className="text-muted text-xs">
                Redemptions appear in the Redemptions queue. Gift-card auto-fulfilment is not enabled.
              </p>
            </div>
          </div>
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="active-switch">Visible in store</Label>
              <p className="text-muted text-xs">
                Hidden offerings stay in the catalogue but staff cannot see or redeem them.
              </p>
            </div>
            <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || uploading}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create offering"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VisibleToggle({ row }: { row: RewardRow }) {
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={row.active}
      disabled={pending}
      aria-label={row.active ? "Visible in store" : "Hidden from store"}
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

function ReorderButtons({ row }: { row: RewardRow }) {
  const [pending, start] = useTransition();
  function move(direction: "up" | "down") {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("direction", direction);
    start(async () => {
      const res = await reorderReward(fd);
      if (!res.ok) toast.error(res.error);
    });
  }
  return (
    <div className="flex gap-1">
      <Button size="xs" variant="outline" disabled={pending} onClick={() => move("up")} aria-label="Move up">
        <ArrowUp className="size-3.5" />
      </Button>
      <Button size="xs" variant="outline" disabled={pending} onClick={() => move("down")} aria-label="Move down">
        <ArrowDown className="size-3.5" />
      </Button>
    </div>
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
    {
      id: "image",
      header: () => <span className="sr-only">Image</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.imageUrl}
            alt=""
            className="size-9 rounded-md object-cover"
          />
        ) : (
          <span className="bg-secondary text-muted inline-flex size-9 items-center justify-center rounded-md text-[10px]">
            —
          </span>
        ),
    },
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
      id: "visible",
      header: "In store",
      enableSorting: false,
      cell: ({ row }) => <VisibleToggle row={row.original} />,
    },
    {
      id: "order",
      header: "Order",
      enableSorting: false,
      cell: ({ row }) => <ReorderButtons row={row.original} />,
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
        searchPlaceholder="Search offerings…"
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New offering
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
