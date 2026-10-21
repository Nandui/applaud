"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Images, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import {
  COSMETIC_KINDS,
  DEFAULT_BANNER,
  DEFAULT_LOOK,
  DEFAULT_THEME,
  KIND_LABELS,
  RARITIES,
  RARITY,
  bannerCss,
  type Cosmetic,
  type CosmeticKind,
  type Rarity,
} from "@/lib/cosmetics";
import {
  addCosmeticsInBulk,
  deleteCosmetic,
  moveCosmetic,
  saveCosmetic,
  setCosmeticActive,
  type ActionResult,
} from "@/lib/store-actions";
import { centsToEuros, pointsToCents } from "@/lib/economy";
import { formatNumber, pts } from "@/lib/format";
import { FramedAvatar } from "@/components/user-avatar";
import { ProfilePreview } from "@/components/shop/profile-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StoreRow = Cosmetic & {
  /** How many people have paid for it (only unbought items can be deleted). */
  buyers: number;
};

type Sample = { name: string; avatarUrl: string | null };

/** What each kind's picture should look like, shown next to the upload button. */
const PICTURE_HINTS: Record<Exclude<CosmeticKind, "theme">, string> = {
  frame:
    "A square PNG, WebP or GIF with a see-through middle, at least 256×256. It's drawn 20% bigger than the avatar, so the photo fills the middle 5/6. Animated GIFs work.",
  banner: "A wide picture, about 3:1 (for example 1500×500). It's cropped to fit, so keep the important part in the middle.",
};

const DEFAULT_IDS = new Set([DEFAULT_BANNER, DEFAULT_THEME]);

function checkFile(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return `${file.name}: use a PNG, JPG, GIF or WebP.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: pictures must be 8MB or smaller.`;
  return null;
}

/** Upload one picture straight from the browser to Vercel Blob. */
async function uploadPicture(kind: CosmeticKind, file: File): Promise<string> {
  const blob = await upload(`store/${kind}/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/reward/upload",
    contentType: file.type,
  });
  return blob.url;
}

/** "neon-wave_v2.png" -> "Neon wave v2" */
function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 40) || "New item";
}

/** The item drawn small, the way the Store shows it. */
function ItemArt({ item, sample, className }: { item: Pick<Cosmetic, "kind" | "style" | "imageUrl">; sample: Sample; className?: string }) {
  if (item.kind === "frame") {
    const art = item.imageUrl ?? item.style;
    return (
      <span className={cn("flex items-center justify-center", className)}>
        <FramedAvatar name={sample.name} avatarUrl={sample.avatarUrl} frame={art} className="size-14" gapClassName="bg-surface" />
      </span>
    );
  }
  if (item.kind === "banner") {
    return <span className={cn("block", className)} style={{ background: bannerCss(item) }} />;
  }
  return (
    <span className={cn("flex items-center justify-center", className)}>
      <span className="size-12 rounded-full" style={{ backgroundColor: item.style ?? undefined }} />
    </span>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  editing,
  initialKind,
  sample,
  pointsPerEuro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StoreRow | null;
  initialKind: CosmeticKind;
  sample: Sample;
  pointsPerEuro: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(saveCosmetic, undefined);
  const [kind, setKind] = useState<CosmeticKind>(editing?.kind ?? initialKind);
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(String(editing?.price ?? 1));
  const [rarity, setRarity] = useState<Rarity>(editing?.rarity ?? "common");
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [colour, setColour] = useState(editing?.kind === "theme" && editing.style ? editing.style : "#6a4dff");
  const [active, setActive] = useState(editing?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const [deleting, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const isDefault = editing ? DEFAULT_IDS.has(editing.id) : false;
  // Built-in frames and banners fall back to their original style without a picture.
  const builtinStyle = editing && editing.kind !== "theme" ? editing.style : null;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, onOpenChange]);

  async function handleFile(file: File) {
    const problem = checkFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try {
      setImageUrl(await uploadPicture(kind, file));
      if (!name) setName(nameFromFile(file.name));
    } catch {
      toast.error("Picture upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const points = Math.max(0, Math.floor(Number(price)) || 0);
  const draft = { kind, style: kind === "theme" ? colour : builtinStyle, imageUrl: kind === "theme" ? null : imageUrl || null };
  const look =
    kind === "frame"
      ? { ...DEFAULT_LOOK, frame: draft.imageUrl ?? draft.style }
      : kind === "banner"
        ? { ...DEFAULT_LOOK, banner: bannerCss(draft) }
        : { ...DEFAULT_LOOK, theme: colour };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New Store item"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="rarity" value={rarity} />
          <input type="hidden" name="imageUrl" value={kind === "theme" ? "" : imageUrl} />
          <input type="hidden" name="colour" value={colour} />
          <input type="hidden" name="active" value={String(active)} />

          {!editing && (
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CosmeticKind)}>
                <SelectTrigger>
                  <SelectValue>{(v: CosmeticKind) => KIND_LABELS[v].one}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COSMETIC_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k].one}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <p className="text-muted mb-1.5 text-xs">How it looks on a profile</p>
            <ProfilePreview name={sample.name} avatarUrl={sample.avatarUrl} look={look} />
          </div>

          {kind === "theme" ? (
            <div className="space-y-1.5">
              <Label htmlFor="colour-input">Accent colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="colour-input"
                  type="color"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="border-border size-9 rounded-md border"
                />
                <Input value={colour} onChange={(e) => setColour(e.target.value)} className="font-mono" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Picture</Label>
              <p className="text-muted text-xs">{PICTURE_HINTS[kind]}</p>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
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
                    {builtinStyle ? "Use the original look" : "Remove"}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" name="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Points</Label>
              <Input
                id="item-price"
                name="price"
                inputMode="numeric"
                value={price}
                disabled={isDefault}
                onChange={(e) => setPrice(e.target.value)}
                className="font-mono"
              />
              <p className="text-muted text-xs" data-numeric>
                {points === 0 ? "Free: everyone owns it" : `${centsToEuros(pointsToCents(points, pointsPerEuro))} face value`}
              </p>
              {isDefault && <input type="hidden" name="price" value="0" />}
            </div>
            <div className="space-y-1.5">
              <Label>Rarity</Label>
              <Select value={rarity} onValueChange={(v) => setRarity(v as Rarity)}>
                <SelectTrigger>
                  <SelectValue>{(v: Rarity) => RARITY[v].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span style={{ color: RARITY[r].color }} className="font-semibold">
                        {RARITY[r].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="item-active">In the Store</Label>
              <p className="text-muted text-xs">Hidden items can&apos;t be bought. People who own one keep it.</p>
            </div>
            <Switch id="item-active" checked={active} disabled={isDefault} onCheckedChange={setActive} />
          </div>

          <DialogFooter className="sm:justify-between">
            {editing && !isDefault && editing.buyers === 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    if (!window.confirm(`Delete ${editing.name}? Nobody has bought it yet.`)) return;
                    const res = await deleteCosmetic(editing.id);
                    if (res.ok) {
                      toast.success(res.message ?? "Deleted.");
                      onOpenChange(false);
                    } else toast.error(res.error);
                  })
                }
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || uploading}>
                {pending ? "Saving…" : editing ? "Save" : "Add to Store"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pick many pictures at once; each becomes a new frame or banner named after its file. */
function BulkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<"frame" | "banner">("frame");
  const [price, setPrice] = useState("1");
  const [active, setActive] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  async function run() {
    const points = Number(price);
    if (!Number.isInteger(points) || points < 0) return void toast.error("Enter a whole number of points.");
    const items: { name: string; imageUrl: string }[] = [];
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        items.push({ name: nameFromFile(file.name), imageUrl: await uploadPicture(kind, file) });
      } catch {
        toast.error(`${file.name} didn't upload.`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (items.length > 0) {
      const res = await addCosmeticsInBulk({ kind, price: points, active, items });
      if (res.ok) {
        toast.success(res.message ?? "Added.");
        setFiles([]);
        onOpenChange(false);
      } else toast.error(res.error);
    }
    setProgress(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload several pictures</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted text-sm">
            Each picture becomes its own item, named after the file. You can rename, reprice and set the rarity of
            each one afterwards.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "frame" | "banner")} disabled={busy}>
                <SelectTrigger>
                  <SelectValue>{(v: "frame" | "banner") => KIND_LABELS[v].many}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frame">{KIND_LABELS.frame.many}</SelectItem>
                  <SelectItem value="banner">{KIND_LABELS.banner.many}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-price">Points each</Label>
              <Input
                id="bulk-price"
                inputMode="numeric"
                value={price}
                disabled={busy}
                onChange={(e) => setPrice(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-muted text-xs">{PICTURE_HINTS[kind]}</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              const problems = picked.map(checkFile).filter(Boolean);
              problems.slice(0, 3).forEach((p) => toast.error(p));
              setFiles(picked.filter((f) => !checkFile(f)).slice(0, 50));
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Images className="size-4" /> {files.length ? `${files.length} pictures chosen` : "Choose pictures"}
          </Button>
          {files.length > 0 && (
            <ul className="text-muted max-h-32 space-y-0.5 overflow-y-auto text-xs">
              {files.map((f) => (
                <li key={f.name + f.size} className="truncate">
                  {nameFromFile(f.name)} <span className="opacity-60">({f.name})</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="bulk-active">Put them in the Store straight away</Label>
            <Switch id="bulk-active" checked={active} disabled={busy} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || files.length === 0} onClick={() => void run()}>
            {progress ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading {progress.done}/{progress.total}
              </>
            ) : (
              `Add ${files.length || ""} ${files.length === 1 ? KIND_LABELS[kind].one.toLowerCase() : KIND_LABELS[kind].many.toLowerCase()}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemTile({
  row,
  sample,
  euros,
  first,
  last,
  onEdit,
}: {
  row: StoreRow;
  sample: Sample;
  euros: (points: number) => string;
  first: boolean;
  last: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className={cn("border-border bg-background rounded-xl border p-2", !row.active && "opacity-60")}>
      <button type="button" onClick={onEdit} className="block w-full text-left">
        <span className="bg-surface border-border relative block aspect-[4/3] overflow-hidden rounded-lg border">
          <ItemArt item={row} sample={sample} className="h-full w-full" />
          {!row.active && (
            <span className="bg-foreground text-background absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold">
              Hidden
            </span>
          )}
        </span>
        <span className="mt-1.5 block truncate text-sm font-semibold">{row.name}</span>
        <span style={{ color: RARITY[row.rarity].color }} className="block text-xs font-semibold">
          {RARITY[row.rarity].label}
        </span>
        <span className="block text-xs font-medium" data-numeric>
          {row.price === 0 ? "Free" : `${pts(row.price)} · ${euros(row.price)}`}
        </span>
        <span className="text-muted block text-xs" data-numeric>
          {row.buyers === 0 ? "Not bought yet" : `Bought by ${formatNumber(row.buyers)}`}
        </span>
      </button>
      <div className="mt-2 flex items-center gap-1">
        <Button size="xs" variant="outline" onClick={onEdit} aria-label={`Edit ${row.name}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" disabled={pending || first} onClick={() => run(() => moveCosmetic(row.id, "up"))} aria-label="Move earlier">
          <ArrowUp className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" disabled={pending || last} onClick={() => run(() => moveCosmetic(row.id, "down"))} aria-label="Move later">
          <ArrowDown className="size-3.5" />
        </Button>
        <span className="ml-auto">
          <Switch
            checked={row.active}
            disabled={pending || DEFAULT_IDS.has(row.id)}
            aria-label={row.active ? "In the Store" : "Hidden from the Store"}
            onCheckedChange={(checked) => run(() => setCosmeticActive(row.id, checked))}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Admin > Store: every frame, banner and theme staff can buy, with uploads for
 * your own pictures, prices in points (and their euro face value), rarity,
 * order, and show/hide.
 */
export function StoreManager({
  rows,
  sample,
  pointsPerEuro,
  typicalShoutout,
}: {
  rows: StoreRow[];
  sample: Sample;
  pointsPerEuro: number;
  /** A typical shout-out, for "one shout-out buys N items". */
  typicalShoutout: number;
}) {
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [newKind, setNewKind] = useState<CosmeticKind>("frame");
  const [itemOpen, setItemOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);

  const euros = (points: number) => centsToEuros(pointsToCents(points, pointsPerEuro));
  const forSale = rows.filter((r) => r.active && r.price > 0);
  const collection = forSale.reduce((sum, r) => sum + r.price, 0);
  const cheapest = forSale.length ? Math.min(...forSale.map((r) => r.price)) : 0;

  const openItem = (row: StoreRow | null, kind: CosmeticKind = "frame") => {
    setEditing(row);
    setNewKind(kind);
    setDialogKey((k) => k + 1);
    setItemOpen(true);
  };

  return (
    <>
      <Card className="mb-6">
        <CardContent className="space-y-3">
          <p className="text-muted text-sm">
            Frames, banners and themes cost the company nothing, so keep them cheap: the point is that people
            spend, not save. Everything for sale together costs{" "}
            <b className="text-foreground" data-numeric>
              {formatNumber(collection)} pts
            </b>{" "}
            ({euros(collection)} face value)
            {cheapest > 0 ? (
              <>
                , and a {formatNumber(typicalShoutout)}-point shout-out buys the cheapest item{" "}
                <span data-numeric>{formatNumber(Math.floor(typicalShoutout / cheapest))}</span> times over
              </>
            ) : null}
            . Items priced 0 are free and everyone owns them.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => openItem(null)}>
              <Plus className="size-4" /> Add item
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Images className="size-4" /> Upload several
            </Button>
            <Link href="/shop" className="text-primary ml-auto text-sm font-medium">
              View the Store
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {COSMETIC_KINDS.map((kind) => {
          const list = rows.filter((r) => r.kind === kind);
          return (
            <section key={kind}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  {KIND_LABELS[kind].many}{" "}
                  <span className="text-muted text-sm font-medium" data-numeric>
                    {list.filter((r) => r.active).length} in the Store
                    {list.some((r) => !r.active) ? `, ${list.filter((r) => !r.active).length} hidden` : ""}
                  </span>
                </h2>
                <Button size="xs" variant="outline" onClick={() => openItem(null, kind)}>
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              {list.length === 0 ? (
                <p className="text-muted text-sm">Nothing here yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((row, i) => (
                    <ItemTile
                      key={row.id}
                      row={row}
                      sample={sample}
                      euros={euros}
                      first={i === 0}
                      last={i === list.length - 1}
                      onEdit={() => openItem(row)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <ItemDialog
        key={dialogKey}
        open={itemOpen}
        onOpenChange={setItemOpen}
        editing={editing}
        initialKind={newKind}
        sample={sample}
        pointsPerEuro={pointsPerEuro}
      />
      <BulkDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </>
  );
}

