"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { uploadPresigned } from "@vercel/blob/client";
import { uploadErrorMessage } from "@/lib/upload-error";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FolderPlus, Images, Loader2, Pencil, Plus, RotateCcw, Trash2, Upload, Wand2 } from "lucide-react";
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
  frameArt,
  type Cosmetic,
  type CosmeticKind,
  type Rarity,
  type StoreCategory,
} from "@/lib/cosmetics";
import { DEFAULT_FIT, clampFit, formatFit, parseFit, sameFit, type FrameFit } from "@/lib/frame-fit";
import { measureFrame } from "@/lib/frame-measure";
import {
  addCosmeticsInBulk,
  deleteCategory,
  deleteCosmetic,
  moveCategory,
  moveCosmetic,
  saveCategory,
  saveCosmetic,
  saveFrameFits,
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

const NO_CATEGORY = "none";

/** Pick a Store category (or none) for an item. */
function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: StoreCategory[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const label = (v: string) =>
    v === NO_CATEGORY ? "No category" : (categories.find((c) => c.id === v)?.name ?? "No category");
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))} disabled={disabled}>
      <SelectTrigger>
        <SelectValue>{(v: string) => label(v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>No category</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {c.active ? "" : " (hidden)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** What each kind's picture should look like, shown next to the upload button. */
const PICTURE_HINTS: Record<Exclude<CosmeticKind, "theme">, string> = {
  frame:
    "A PNG, WebP or GIF with a see-through middle, at least 256×256. The see-through hole is found and fitted to the avatar automatically, so padding and ornaments are fine. Animated GIFs work.",
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
  const blob = await uploadPresigned(`store/${kind}/${file.name}`, file, {
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
function ItemArt({
  item,
  sample,
  className,
}: {
  item: Pick<Cosmetic, "kind" | "style" | "imageUrl" | "frameFit">;
  sample: Sample;
  className?: string;
}) {
  if (item.kind === "frame") {
    return (
      <span className={cn("flex items-center justify-center", className)}>
        <FramedAvatar name={sample.name} avatarUrl={sample.avatarUrl} frame={frameArt(item)} className="size-14" gapClassName="bg-surface" />
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

/** One fit slider: a label, a range and its value. */
function FitSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full"
      />
      <span className="text-right font-mono" data-numeric>
        {format(value)}
      </span>
    </label>
  );
}

/**
 * How an uploaded frame sits on the avatar: previews at the sizes the app uses,
 * an Auto-fit that finds the picture's see-through hole, and sliders to nudge.
 */
function FrameFitControls({
  imageUrl,
  fit,
  onChange,
  sample,
}: {
  imageUrl: string;
  fit: FrameFit;
  onChange: (fit: FrameFit) => void;
  sample: Sample;
}) {
  const [measuring, setMeasuring] = useState(false);
  const art = `${imageUrl}#fit=${formatFit(fit)}`;
  const set = (patch: Partial<FrameFit>) => onChange(clampFit({ ...fit, ...patch }));

  async function autoFit() {
    setMeasuring(true);
    const measured = await measureFrame(imageUrl);
    setMeasuring(false);
    if (measured) {
      onChange(measured);
      toast.success("Fitted to the see-through middle.");
    } else toast.error("Couldn't find a see-through middle. Use the sliders instead.");
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Fit to the avatar</Label>
        <div className="flex gap-1">
          <Button type="button" size="xs" variant="outline" disabled={measuring} onClick={autoFit}>
            {measuring ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Auto-fit
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={sameFit(fit, DEFAULT_FIT)}
            onClick={() => onChange(DEFAULT_FIT)}
            aria-label="Reset the fit"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="bg-surface flex items-center justify-center gap-6 rounded-md py-4">
        {["size-9", "size-14", "size-20"].map((size) => (
          <FramedAvatar
            key={size}
            name={sample.name}
            avatarUrl={sample.avatarUrl}
            frame={art}
            className={size}
            gapClassName="bg-surface"
          />
        ))}
      </div>
      <div className="space-y-1.5">
        <FitSlider
          label="Size"
          value={fit.size}
          min={0.8}
          max={3}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(size) => set({ size })}
        />
        {/* Moving the frame right means a point further left of the picture sits on the avatar. */}
        <FitSlider
          label="Left / right"
          value={Math.round((0.5 - fit.x) * 1000) / 10}
          min={-30}
          max={30}
          step={0.5}
          format={(v) => (v > 0 ? `+${v}` : String(v))}
          onChange={(v) => set({ x: 0.5 - v / 100 })}
        />
        <FitSlider
          label="Up / down"
          value={Math.round((0.5 - fit.y) * 1000) / 10}
          min={-30}
          max={30}
          step={0.5}
          format={(v) => (v > 0 ? `+${v}` : String(v))}
          onChange={(v) => set({ y: 0.5 - v / 100 })}
        />
      </div>
      <p className="text-muted text-xs">
        Auto-fit puts the see-through middle exactly over the photo. Nudge it if the art should overlap a bit.
      </p>
    </div>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  editing,
  initialKind,
  initialCategory,
  categories,
  sample,
  pointsPerEuro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StoreRow | null;
  initialKind: CosmeticKind;
  initialCategory: string | null;
  categories: StoreCategory[];
  sample: Sample;
  pointsPerEuro: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(saveCosmetic, undefined);
  const [kind, setKind] = useState<CosmeticKind>(editing?.kind ?? initialKind);
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(String(editing?.price ?? 1));
  const [rarity, setRarity] = useState<Rarity>(editing?.rarity ?? "common");
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [fit, setFit] = useState<FrameFit>(parseFit(editing?.frameFit) ?? DEFAULT_FIT);
  const [colour, setColour] = useState(editing?.kind === "theme" && editing.style ? editing.style : "#6a4dff");
  const [active, setActive] = useState(editing?.active ?? true);
  const [categoryId, setCategoryId] = useState((editing ? editing.categoryId : initialCategory) ?? NO_CATEGORY);
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
      // Measure the frame from the file itself while it uploads.
      const [url, measured] = await Promise.all([
        uploadPicture(kind, file),
        kind === "frame" ? measureFrame(file) : Promise.resolve(null),
      ]);
      setImageUrl(url);
      setFit(measured ?? DEFAULT_FIT);
      if (!name) setName(nameFromFile(file.name));
    } catch (error) {
      toast.error(uploadErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const points = Math.max(0, Math.floor(Number(price)) || 0);
  const draft = {
    kind,
    style: kind === "theme" ? colour : builtinStyle,
    imageUrl: kind === "theme" ? null : imageUrl || null,
    frameFit: formatFit(fit),
  };
  const look =
    kind === "frame"
      ? { ...DEFAULT_LOOK, frame: frameArt(draft) }
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
          <input type="hidden" name="frameFit" value={kind === "frame" && imageUrl ? formatFit(fit) : ""} />
          <input type="hidden" name="colour" value={colour} />
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="categoryId" value={categoryId === NO_CATEGORY ? "" : categoryId} />

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
            <ProfilePreview
              name={sample.name}
              avatarUrl={sample.avatarUrl}
              look={look}
              frameRarity={kind === "frame" ? rarity : null}
            />
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

          {kind === "frame" && imageUrl && !uploading && (
            <FrameFitControls imageUrl={imageUrl} fit={fit} onChange={setFit} sample={sample} />
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
                {points === 0 ? "Free: staff claim it in the shop" : `${centsToEuros(pointsToCents(points, pointsPerEuro))} face value`}
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
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
              <p className="text-muted text-xs">Items in a category are grouped together and can be bought as a bundle.</p>
            </div>
          )}
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
function BulkDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: StoreCategory[];
}) {
  const [kind, setKind] = useState<"frame" | "banner">("frame");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);
  const [price, setPrice] = useState("1");
  const [active, setActive] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  async function run() {
    const points = Number(price);
    if (!Number.isInteger(points) || points < 0) return void toast.error("Enter a whole number of points.");
    const items: { name: string; imageUrl: string; frameFit: string | null }[] = [];
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        const [imageUrl, fit] = await Promise.all([
          uploadPicture(kind, file),
          kind === "frame" ? measureFrame(file) : Promise.resolve(null),
        ]);
        items.push({ name: nameFromFile(file.name), imageUrl, frameFit: fit ? formatFit(fit) : null });
      } catch (error) {
        toast.error(`${file.name}: ${uploadErrorMessage(error, "didn't upload.")}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (items.length > 0) {
      const res = await addCosmeticsInBulk({
        kind,
        price: points,
        active,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        items,
      });
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
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} disabled={busy} />
            </div>
          )}
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
  categoryName,
}: {
  row: StoreRow;
  sample: Sample;
  euros: (points: number) => string;
  categoryName: string | null;
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
        {categoryName && <span className="text-muted block truncate text-xs">In {categoryName}</span>}
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

/** Add or rename a category, and show or hide it in the shop. */
function CategoryDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StoreCategory | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveCategory({ id: editing?.id, name, active });
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        onOpenChange(false);
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New category"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={30}
              placeholder="Flags"
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-muted text-xs">
              Frames, banners and themes in a category show together in the shop, with a button to buy them all
              at the same total as buying each one.
            </p>
          </div>
          <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="category-active">Show in the Store</Label>
              <p className="text-muted text-xs">When hidden, its items are listed by kind and there&apos;s no bundle.</p>
            </div>
            <Switch id="category-active" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One category: its items, bundle price in points and euros, and controls. */
function CategoryRow({
  category,
  items,
  euros,
  first,
  last,
  onEdit,
  onAddItem,
}: {
  category: StoreCategory;
  items: StoreRow[];
  euros: (points: number) => string;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onAddItem: () => void;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      if (res.ok && res.message) toast.success(res.message);
      else if (!res.ok) toast.error(res.error);
    });
  const forSale = items.filter((r) => r.active);
  const bundle = forSale.reduce((sum, r) => sum + r.price, 0);
  const hidden = items.length - forSale.length;

  return (
    <li className={cn("border-border flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5", !category.active && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {category.name}
          {!category.active && <span className="text-muted font-medium"> · hidden</span>}
        </p>
        <p className="text-muted text-xs" data-numeric>
          {forSale.length === 0
            ? "No items for sale yet"
            : `${forSale.length} ${forSale.length === 1 ? "item" : "items"} · bundle ${pts(bundle)} · ${euros(bundle)}`}
          {hidden > 0 ? ` · ${hidden} hidden` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="xs" variant="outline" onClick={onAddItem} aria-label={`Add an item to ${category.name}`}>
          <Plus className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" onClick={onEdit} aria-label={`Edit ${category.name}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" disabled={pending || first} onClick={() => run(() => moveCategory(category.id, "up"))} aria-label="Move earlier">
          <ArrowUp className="size-3.5" />
        </Button>
        <Button size="xs" variant="outline" disabled={pending || last} onClick={() => run(() => moveCategory(category.id, "down"))} aria-label="Move later">
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          aria-label={`Delete ${category.name}`}
          onClick={() => {
            if (!window.confirm(`Delete the ${category.name} category? Its items stay in the Store, listed by kind.`)) return;
            run(() => deleteCategory(category.id));
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Switch
          checked={category.active}
          disabled={pending}
          aria-label={category.active ? "In the Store" : "Hidden from the Store"}
          onCheckedChange={(checked) => run(() => saveCategory({ id: category.id, name: category.name, active: checked }))}
        />
      </div>
    </li>
  );
}

/**
 * Admin > Store: every frame, banner and theme staff can buy, with uploads for
 * your own pictures, prices in points (and their euro face value), rarity,
 * order, and show/hide.
 */
export function StoreManager({
  rows,
  categories,
  sample,
  pointsPerEuro,
  typicalShoutout,
}: {
  rows: StoreRow[];
  categories: StoreCategory[];
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
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryKey, setCategoryKey] = useState(0);
  /** "all", NO_CATEGORY, or a category id. */
  const [filter, setFilter] = useState("all");
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const filtered =
    filter === "all"
      ? rows
      : rows.filter((r) => (filter === NO_CATEGORY ? !r.categoryId : r.categoryId === filter));

  const euros = (points: number) => centsToEuros(pointsToCents(points, pointsPerEuro));
  /** Uploaded frames that were added before frames were auto-fitted. */
  const unfitted = rows.filter((r) => r.kind === "frame" && r.imageUrl && !r.frameFit);
  const [fitting, setFitting] = useState(false);
  async function fitAll() {
    setFitting(true);
    const updates: { id: string; frameFit: string }[] = [];
    for (const row of unfitted) {
      const fit = await measureFrame(row.imageUrl!);
      if (fit) updates.push({ id: row.id, frameFit: formatFit(fit) });
    }
    const skipped = unfitted.length - updates.length;
    if (updates.length > 0) {
      const res = await saveFrameFits(updates);
      if (res.ok) toast.success(`${res.message}${skipped ? ` ${skipped} couldn't be measured; fit those by hand.` : ""}`);
      else toast.error(res.error);
    } else toast.error("Couldn't find a see-through middle in those frames. Fit them by hand in Edit.");
    setFitting(false);
  }
  const forSale = rows.filter((r) => r.active && r.price > 0);
  const collection = forSale.reduce((sum, r) => sum + r.price, 0);
  const cheapest = forSale.length ? Math.min(...forSale.map((r) => r.price)) : 0;

  const openCategory = (category: StoreCategory | null) => {
    setEditingCategory(category);
    setCategoryKey((k) => k + 1);
    setCategoryOpen(true);
  };

  const openItem = (row: StoreRow | null, kind: CosmeticKind = "frame", category: string | null = null) => {
    setEditing(row);
    setNewKind(kind);
    setNewCategory(category ?? (filter !== "all" && filter !== NO_CATEGORY ? filter : null));
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
            . Items priced 0 are free, but staff still claim them in the shop.
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

      <Card className="mb-6">
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Categories</h2>
              <p className="text-muted text-sm">
                Group items of any kind (for example Flags or Pride). Staff see each category together with a
                button to buy everything in it they don&apos;t own yet, for the plain total (no discount).
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openCategory(null)}>
              <FolderPlus className="size-4" /> Add category
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-muted text-sm">No categories yet. Everything is listed by kind.</p>
          ) : (
            <ul className="divide-border divide-y">
              {categories.map((category, i) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  items={rows.filter((r) => r.categoryId === category.id)}
                  euros={euros}
                  first={i === 0}
                  last={i === categories.length - 1}
                  onEdit={() => openCategory(category)}
                  onAddItem={() => openItem(null, "banner", category.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[
            { id: "all", name: "All items" },
            ...categories,
            { id: NO_CATEGORY, name: "No category" },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                filter === c.id ? "bg-foreground text-background border-foreground" : "border-border text-muted",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-8">
        {COSMETIC_KINDS.map((kind) => {
          const list = filtered.filter((r) => r.kind === kind);
          // Reordering swaps with the neighbour in the full list, so only offer it unfiltered.
          const canMove = filter === "all";
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
                <div className="flex gap-1.5">
                  {kind === "frame" && unfitted.length > 0 && (
                    <Button size="xs" variant="outline" disabled={fitting} onClick={fitAll}>
                      {fitting ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                      Auto-fit {unfitted.length} {unfitted.length === 1 ? "frame" : "frames"}
                    </Button>
                  )}
                  <Button size="xs" variant="outline" onClick={() => openItem(null, kind)}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
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
                      categoryName={row.categoryId ? (categoryName.get(row.categoryId) ?? null) : null}
                      first={!canMove || i === 0}
                      last={!canMove || i === list.length - 1}
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
        initialCategory={newCategory}
        categories={categories}
        sample={sample}
        pointsPerEuro={pointsPerEuro}
      />
      <BulkDialog open={bulkOpen} onOpenChange={setBulkOpen} categories={categories} />
      <CategoryDialog key={`category-${categoryKey}`} open={categoryOpen} onOpenChange={setCategoryOpen} editing={editingCategory} />
    </>
  );
}

