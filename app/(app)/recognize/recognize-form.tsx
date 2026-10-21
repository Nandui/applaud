"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import {
  Check,
  Search,
  X,
  ImagePlus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Minus,
  Plus,
} from "lucide-react";
import { createRecognition, type ActionResult } from "@/lib/recognition/actions";
import type { AllowanceStatus } from "@/lib/points";
import {
  MAX_RECOGNITION_IMAGES,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/config";
import { valueIcon } from "@/lib/value-icons";
import type { GifResult } from "@/lib/recognition/gif";
import { GifPicker } from "@/components/recognize/gif-picker";
import { UserAvatar } from "@/components/user-avatar";
import { tint } from "@/components/value-chip";
import { AppBar, appBarIconClass } from "@/components/app-shell/app-bar";
import { Switch } from "@/components/ui/switch";
import { formatNumber, pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type ValueOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};
type RecipientOption = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  siteCode: string;
};

/** Quick-pick point amounts, like a tip screen. */
const POINT_PRESETS = [0, 10, 25, 50];

/**
 * Two-step, full-screen composer (the Instagram "new post" pattern):
 * 1. pick who you're recognising, 2. write it up, attach media, add points.
 * Both steps stay mounted inside one <form> so every field still posts to
 * `createRecognition` exactly as before.
 */
export function RecognizeForm({
  values,
  recipients,
  allowance,
  initialSelected = [],
}: {
  values: ValueOption[];
  recipients: RecipientOption[];
  allowance: AllowanceStatus;
  /** Recipients to preselect (from ?to=…); jumps straight to step 2. */
  initialSelected?: string[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createRecognition,
    undefined,
  );

  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [step, setStepState] = useState<1 | 2>(initialSelected.length > 0 ? 2 : 1);
  // Each step is its own "screen": start it at the top, like a pushed view.
  function setStep(next: 1 | 2) {
    setStepState(next);
    window.scrollTo({ top: 0 });
  }
  const [message, setMessage] = useState("");
  const [valueId, setValueId] = useState<string>("");
  const [rawPoints, setPoints] = useState<number>(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState("");

  // Uploaded image attachments (Vercel Blob public URLs) + in-flight uploads.
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Committed + in-flight slot count. A ref (not state) so it updates
  // synchronously: rapid successive picks reserve against the latest value
  // before any await, instead of racing on a stale render closure.
  const reservedRef = useRef(0);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const room = MAX_RECOGNITION_IMAGES - reservedRef.current;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_RECOGNITION_IMAGES} images.`);
      return;
    }
    const candidates = Array.from(fileList).slice(0, room);
    if (candidates.length < fileList.length) {
      toast.error(`Only ${MAX_RECOGNITION_IMAGES} images allowed — extras skipped.`);
    }
    const valid = candidates.filter((file) => {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: use a PNG, JPG, GIF, or WebP.`);
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name}: images must be 8MB or smaller.`);
        return false;
      }
      return true;
    });
    // Claim slots synchronously, before the first await, so a concurrent pick
    // sees the reservation and can't push the total past the cap.
    reservedRef.current += valid.length;
    for (const file of valid) {
      setUploadingCount((c) => c + 1);
      try {
        const blob = await upload(`recognitions/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/recognition/upload",
          contentType: file.type,
        });
        setImages((imgs) => [...imgs, { url: blob.url, name: file.name }]);
      } catch {
        reservedRef.current = Math.max(0, reservedRef.current - 1);
        toast.error(`${file.name}: upload failed.`);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  }

  function removeImage(url: string) {
    if (!images.some((img) => img.url === url)) return;
    reservedRef.current = Math.max(0, reservedRef.current - 1);
    setImages((imgs) => imgs.filter((img) => img.url !== url));
    // NOTE: the blob itself is not deleted here. Client-direct uploads exist in
    // Blob the moment they're picked, so removed (or abandoned) attachments
    // leave orphans. Reclaim them with a scheduled cleanup that deletes blobs
    // under `recognitions/` not referenced by any Recognition.imageUrls, rather
    // than a client-triggered delete (the RW token must stay server-side, and
    // an unscoped delete-by-URL would let one user delete another's blob).
  }

  // A GIF picked from library search is stored like an uploaded attachment —
  // its URL joins the same `images`/`imageUrls` set and shares the cap. It's
  // already hosted (no upload), so it commits immediately.
  function addGif(gif: GifResult) {
    if (reservedRef.current >= MAX_RECOGNITION_IMAGES) {
      toast.error(`You can attach up to ${MAX_RECOGNITION_IMAGES} images.`);
      return;
    }
    if (images.some((img) => img.url === gif.url)) return;
    reservedRef.current += 1;
    setImages((imgs) => [...imgs, { url: gif.url, name: gif.title || "GIF" }]);
  }

  const byId = useMemo(
    () => new Map(recipients.map((r) => [r.id, r])),
    [recipients],
  );

  const maxPerRecipient =
    selected.length > 0
      ? Math.floor(allowance.remaining / selected.length)
      : allowance.remaining;

  // Keep points within what the allowance permits as the selection changes.
  const points = Math.min(rawPoints, Math.max(0, maxPerRecipient));

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Recognition posted!");
      router.push("/");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const totalPoints = points * selected.length;
  const remainingAfter = allowance.remaining - totalPoints;

  const filtered = recipients.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.jobTitle ?? "").toLowerCase().includes(q) ||
      r.siteCode.toLowerCase().includes(q)
    );
  });

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const canSubmit =
    selected.length > 0 &&
    valueId !== "" &&
    message.trim() !== "" &&
    !pending &&
    uploadingCount === 0;
  const selectedPeople = selected
    .map((id) => byId.get(id))
    .filter((r): r is RecipientOption => Boolean(r));
  const activeValue = values.find((v) => v.id === valueId) ?? null;
  const usedPct =
    allowance.total > 0
      ? Math.min(100, Math.round(((allowance.total - remainingAfter) / allowance.total) * 100))
      : 100;
  // Desktop has the TopNav, so the composer bar shows there too, under it.
  const barClass =
    "md:sticky md:top-15 md:mx-0 md:mb-4 md:block md:rounded-2xl md:border";

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      {/* Hidden fields the server action reads */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="recipientIds" value={id} />
      ))}
      <input type="hidden" name="valueId" value={valueId} />
      <input type="hidden" name="points" value={points} />
      <input type="hidden" name="visibility" value={isPrivate ? "private" : "public"} />
      {images.map((img) => (
        <input key={img.url} type="hidden" name="imageUrls" value={img.url} />
      ))}

      {/* ---------------- Step 1: who ---------------- */}
      <div className={cn(step !== 1 && "hidden")}>
        <AppBar
          className={barClass}
          leading={
            <Link href="/" aria-label="Close" className={appBarIconClass}>
              <X className="size-6" />
            </Link>
          }
          title={<span className="text-[1.1rem]">Who are you recognising?</span>}
          trailing={
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={selected.length === 0}
              className="text-primary disabled:text-muted/50 px-2 text-base font-semibold"
            >
              Next
            </button>
          }
        >
          <div className="relative">
            <Search className="text-muted absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role or site"
              type="search"
              className="bg-secondary placeholder:text-muted h-10 w-full rounded-xl pr-3 pl-10 text-sm outline-none"
            />
          </div>
        </AppBar>

        {/* Selected people, as removable avatars */}
        <AnimatePresence initial={false}>
          {selectedPeople.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-3">
                {selectedPeople.map((r) => (
                  <motion.button
                    key={r.id}
                    type="button"
                    layout
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => toggle(r.id)}
                    className="flex w-16 shrink-0 flex-col items-center gap-1"
                    aria-label={`Remove ${r.name}`}
                  >
                    <span className="relative">
                      <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="size-14" />
                      <span className="bg-foreground ring-background absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full text-white ring-2">
                        <X className="size-3" strokeWidth={3} />
                      </span>
                    </span>
                    <span className="w-full truncate text-center text-xs">
                      {r.name.split(" ")[0]}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-surface -mx-4 md:mx-0 md:rounded-2xl md:border">
          {filtered.length === 0 ? (
            <p className="text-muted p-10 text-center text-sm">No matches.</p>
          ) : (
            filtered.map((r) => {
              const active = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={active}
                  className="active:bg-secondary flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
                >
                  <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-semibold">{r.name}</p>
                    <p className="text-muted truncate text-[0.8rem]">
                      {r.jobTitle ?? "—"}
                      {r.siteCode && ` · ${r.siteCode}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {active && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Thumb-reachable continue button */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-3 md:static md:px-0"
            >
              <button
                type="button"
                onClick={() => setStep(2)}
                className="bg-foreground mx-auto mb-3 flex h-13 w-full max-w-xl items-center justify-center gap-2 rounded-full text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
              >
                Continue with {selected.length}{" "}
                {selected.length === 1 ? "person" : "people"}
                <ChevronRight className="size-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- Step 2: compose ---------------- */}
      <div className={cn(step !== 2 && "hidden")}>
        <AppBar
          className={barClass}
          leading={
            <button
              type="button"
              onClick={() => setStep(1)}
              aria-label="Back to recipients"
              className={appBarIconClass}
            >
              <ChevronLeft className="size-6.5" strokeWidth={2.25} />
            </button>
          }
          title={<span className="text-[1.1rem]">New recognition</span>}
          trailing={
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-primary disabled:text-muted/50 px-2 text-base font-semibold"
            >
              {pending ? "Posting…" : "Share"}
            </button>
          }
        />

        <div className="space-y-3">
          {/* To: — tap to edit */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="bg-surface flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
          >
            <span className="text-muted text-sm font-medium">To</span>
            <span className="flex -space-x-2">
              {selectedPeople.slice(0, 4).map((r) => (
                <UserAvatar
                  key={r.id}
                  name={r.name}
                  avatarUrl={r.avatarUrl}
                  className="ring-surface size-8 text-[0.6rem] ring-2"
                />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {selectedPeople.map((r) => r.name.split(" ")[0]).join(", ")}
            </span>
            <ChevronRight className="text-muted size-4.5" />
          </button>

          {/* The message, on a card tinted by the chosen value */}
          <div
            className="bg-surface overflow-hidden rounded-2xl transition-colors"
            style={
              activeValue?.color
                ? {
                    backgroundImage: `linear-gradient(160deg, ${tint(activeValue.color, 0.16)}, transparent 70%)`,
                  }
                : undefined
            }
          >
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What did they do? Be specific — it means more."
              rows={5}
              maxLength={500}
              required
              className="font-display placeholder:text-muted/70 block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-lg leading-snug font-medium outline-none"
            />
            <p data-numeric className="text-muted px-4 pb-3 text-right text-xs">
              {message.length}/500
            </p>
          </div>

          {/* Value */}
          <section className="space-y-2">
            <h2 className="text-muted px-1 text-xs font-semibold tracking-wide uppercase">
              Which value did they live?
            </h2>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
              {values.map((v) => {
                const Icon = valueIcon(v.icon);
                const active = valueId === v.id;
                return (
                  <motion.button
                    key={v.id}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setValueId(active ? "" : v.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                      active ? "text-white shadow-md" : "bg-surface text-foreground",
                    )}
                    style={
                      active
                        ? { backgroundColor: v.color ?? "var(--color-primary)" }
                        : undefined
                    }
                  >
                    <Icon
                      className="size-4"
                      style={!active && v.color ? { color: v.color } : undefined}
                    />
                    {v.name}
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Photos / GIFs */}
          <section className="space-y-2">
            <h2 className="text-muted px-1 text-xs font-semibold tracking-wide uppercase">
              Add a photo or GIF
            </h2>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {images.length + uploadingCount < MAX_RECOGNITION_IMAGES && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-secondary flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl transition-transform active:scale-95"
                  >
                    <ImagePlus className="size-5" />
                    <span className="text-[0.7rem] font-semibold">Photo</span>
                  </button>
                  <GifPicker onSelect={addGif} />
                </>
              )}
              {images.map((img) => (
                <div
                  key={img.url}
                  className="relative size-20 shrink-0 overflow-hidden rounded-2xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.url)}
                    aria-label={`Remove ${img.name}`}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {Array.from({ length: uploadingCount }).map((_, i) => (
                <div
                  key={`uploading-${i}`}
                  className="bg-secondary flex size-20 shrink-0 items-center justify-center rounded-2xl"
                >
                  <Loader2 className="text-muted size-5 animate-spin" />
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="text-muted px-1 text-xs">
              Up to {MAX_RECOGNITION_IMAGES} · PNG, JPG, GIF, or WebP · max 8MB each
            </p>
          </section>

          {/* Points */}
          <section className="bg-surface space-y-3 rounded-2xl p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                Add points <span className="text-muted font-normal">· each</span>
              </h2>
              <span className="text-muted text-xs">
                <span data-numeric className="text-foreground font-semibold">
                  {formatNumber(Math.max(0, remainingAfter))}
                </span>{" "}
                of <span data-numeric>{formatNumber(allowance.total)}</span> left
              </span>
            </div>
            <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
              <motion.div
                className="bg-brand h-full rounded-full"
                animate={{ width: `${usedPct}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Fewer points"
                disabled={points <= 0}
                onClick={() => setPoints(Math.max(0, points - 5))}
                className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-40"
              >
                <Minus className="size-4.5" />
              </button>
              <input
                id="points-input"
                type="number"
                inputMode="numeric"
                aria-label="Points each"
                min={0}
                max={maxPerRecipient}
                value={points}
                onChange={(e) =>
                  setPoints(
                    Math.max(0, Math.min(maxPerRecipient, Number(e.target.value) || 0)),
                  )
                }
                disabled={allowance.remaining === 0}
                className="font-numeric min-w-0 flex-1 bg-transparent text-center text-3xl font-semibold outline-none"
              />
              <button
                type="button"
                aria-label="More points"
                disabled={points + 5 > maxPerRecipient}
                onClick={() => setPoints(Math.min(maxPerRecipient, points + 5))}
                className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-40"
              >
                <Plus className="size-4.5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {POINT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={n > maxPerRecipient}
                  onClick={() => setPoints(n)}
                  className={cn(
                    "h-10 rounded-full text-sm font-semibold transition-colors disabled:opacity-40",
                    points === n ? "bg-foreground text-white" : "bg-secondary",
                  )}
                >
                  <span data-numeric>{n === 0 ? "None" : n}</span>
                </button>
              ))}
            </div>
            {selected.length > 1 && points > 0 && (
              <p className="text-muted text-xs">
                {pts(points)} × {selected.length} people ={" "}
                <span data-numeric className="text-foreground font-semibold">
                  {pts(totalPoints)}
                </span>
              </p>
            )}
          </section>

          {/* Visibility */}
          <label className="bg-surface flex items-center gap-3 rounded-2xl p-4">
            <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
              <Lock className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Private</span>
              <span className="text-muted block text-xs">
                Only you and {selected.length === 1 ? "them" : "the recipients"} will see it.
              </span>
            </span>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </label>

          {/* Primary action in the thumb zone */}
          <div className="pb-safe sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-[var(--color-background)] from-60% to-transparent px-4 pt-4 md:static md:mx-0 md:bg-none md:px-0">
            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={{ scale: 0.98 }}
              className="bg-brand mb-3 flex h-13 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white shadow-[0_8px_24px_-6px_rgb(217_70_239/0.6)] disabled:opacity-40 disabled:shadow-none"
            >
              {pending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <span aria-hidden className="text-lg">👏</span>
              )}
              {pending
                ? "Posting…"
                : !valueId
                  ? "Pick a value to post"
                  : !message.trim()
                    ? "Write a message to post"
                    : "Post recognition"}
            </motion.button>
          </div>
        </div>
      </div>
    </form>
  );
}
