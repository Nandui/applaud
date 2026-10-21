"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Pencil, Plus, Upload } from "lucide-react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { ValueSeal } from "@/components/value-seal";
import { saveValue, setValueActive, type ActionResult } from "@/lib/admin/actions";
import { VALUE_ICON_NAMES } from "@/lib/value-icons";
import { ValueIcon } from "@/components/value-icon";
import { DataTable } from "@/components/data-table";
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
  imageUrl: string | null;
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
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(editing?.name ?? "");

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
      const blob = await upload(`values/${file.name}`, file, {
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
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit value" : "New value"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="imageUrl" value={imageUrl} />

          <div className="bg-surface-2 flex items-center gap-4 rounded-xl p-4">
            <ValueSeal
              value={{ name: name || "Value", icon, color, imageUrl: imageUrl || null }}
              size="lg"
            />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-semibold">Badge picture</p>
              <p className="text-muted text-xs">
                Shown on every shout-out for this value. A square picture works best; without one, the icon
                and colour below are used.
              </p>
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
                      {imageUrl ? "Change picture" : "Upload picture"}
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

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
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
                  <ValueIcon icon={icon} className="size-4.5" />
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
            <Button type="submit" disabled={pending || uploading}>
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
        <span className="flex items-center gap-3">
          <ValueSeal value={row.original} size="xs" />
          <span className="font-medium">{row.original.name}</span>
        </span>
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
