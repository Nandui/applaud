"use client";

import { useActionState, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ArrowRight,
  Lock,
  Globe,
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
import { PointsKeypad } from "@/components/recognize/points-keypad";
import { Confetti } from "@/components/fx/confetti";
import { UserAvatar } from "@/components/user-avatar";
import { tint } from "@/components/value-chip";
import { pts } from "@/lib/format";
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

/**
 * The Send flow, built from screens people already know:
 * 1. "Send to" — Snapchat's people picker (search, Recents, round checks,
 *    a sticky bar with the chosen names and a send arrow).
 * 2. Compose — Threads' new-post screen (avatar + thread line, toolbar for
 *    photo / GIF / privacy / points, value chips).
 * 3. Points — Cash App's keypad in a sheet.
 * Then a confetti celebration. Every step stays mounted inside one <form> so
 * all fields still post to `createRecognition` exactly as before.
 */
export function RecognizeForm({
  values,
  recipients,
  allowance,
  initialSelected = [],
  recentIds = [],
  mySiteCode = "",
  me,
}: {
  values: ValueOption[];
  recipients: RecipientOption[];
  allowance: AllowanceStatus;
  /** Recipients to preselect (from ?to=…); jumps straight to compose. */
  initialSelected?: string[];
  recentIds?: string[];
  mySiteCode?: string;
  me: { name: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [sent, setSent] = useState<{ names: string; points: number } | null>(null);
  // Celebrate (or toast the error) from inside the action, not an effect.
  const [, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    async (prev, fd) => {
      const res = await createRecognition(prev, fd);
      if (res.ok) {
        const names = fd
          .getAll("recipientIds")
          .map((id) => recipients.find((r) => r.id === String(id))?.name.split(" ")[0])
          .filter(Boolean) as string[];
        setSent({ names: joinNames(names), points: Number(fd.get("points") ?? 0) });
      } else {
        toast.error(res.error);
      }
      return res;
    },
    undefined,
  );

  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [step, setStepState] = useState<"to" | "write">(
    initialSelected.length > 0 ? "write" : "to",
  );
  function setStep(next: "to" | "write") {
    setStepState(next);
    window.scrollTo({ top: 0 });
  }
  const [message, setMessage] = useState("");
  const [valueId, setValueId] = useState<string>("");
  const [rawPoints, setPoints] = useState<number>(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState("");
  const [keypadOpen, setKeypadOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

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

  const selectedPeople = selected
    .map((id) => byId.get(id))
    .filter((r): r is RecipientOption => Boolean(r));
  const firstNames = selectedPeople.map((r) => r.name.split(" ")[0]);
  const namesLabel = joinNames(firstNames);


  const q = search.trim().toLowerCase();
  const matches = (r: RecipientOption) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    (r.jobTitle ?? "").toLowerCase().includes(q) ||
    r.siteCode.toLowerCase().includes(q);

  // Sections (Snapchat: Recents, then everyone A–Z). While searching, one list.
  const sections: { title: string; people: RecipientOption[] }[] = q
    ? [{ title: "Results", people: recipients.filter(matches) }]
    : [
        {
          title: "Recents",
          people: recentIds.map((id) => byId.get(id)).filter((r): r is RecipientOption => Boolean(r)),
        },
        {
          title: mySiteCode ? `Your site · ${mySiteCode}` : "Your site",
          people: recipients.filter((r) => mySiteCode && r.siteCode === mySiteCode && !recentIds.includes(r.id)),
        },
        {
          title: "Everyone",
          people: recipients.filter(
            (r) => !(mySiteCode && r.siteCode === mySiteCode) && !recentIds.includes(r.id),
          ),
        },
      ];

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const canSubmit =
    selected.length > 0 &&
    valueId !== "" &&
    message.trim().length >= 3 &&
    !pending &&
    uploadingCount === 0;
  const blocker = !message.trim()
    ? "Write what they did"
    : message.trim().length < 3
      ? "A few more words"
      : !valueId
        ? "Pick a value"
        : null;

  if (sent) {
    return (
      <Celebration
        names={sent.names}
        points={sent.points}
        onDone={() => router.push("/")}
        onAgain={() => {
          setSent(null);
          setSelected([]);
          setMessage("");
          setValueId("");
          setPoints(0);
          setImages([]);
          reservedRef.current = 0;
          setIsPrivate(false);
          setStep("to");
          router.refresh();
        }}
      />
    );
  }

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

      {/* ---------------- Step 1: Send to ---------------- */}
      <div className={cn(step !== "to" && "hidden")}>
        <header className="glass pt-safe sticky top-0 z-30 -mx-4 px-4 pb-3 md:mx-0 md:rounded-b-2xl">
          <div className="flex h-14 items-center">
            <Link
              href="/"
              aria-label="Close"
              className="hover:bg-surface-2 -ml-2 flex size-10 items-center justify-center rounded-full"
            >
              <ChevronDown className="size-6.5" />
            </Link>
            <h1 className="flex-1 text-center text-[1.05rem] font-semibold tracking-tight">
              Send to
            </h1>
            <span className="size-10" />
          </div>
          <div className="relative">
            <Search className="text-muted absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role or site"
              type="search"
              className="bg-surface-2 placeholder:text-muted h-11 w-full rounded-full pr-4 pl-10 outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </header>

        <div className="space-y-5 pt-2 pb-32">
          {sections
            .filter((s) => s.people.length > 0)
            .map((section) => (
              <section key={section.title}>
                <h2 className="mb-1.5 px-1 text-sm font-bold">{section.title}</h2>
                <ul className="bg-surface overflow-hidden rounded-2xl">
                  {section.people.map((r) => {
                    const active = selected.includes(r.id);
                    return (
                      <li key={r.id} className="border-border border-b last:border-0">
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          aria-pressed={active}
                          className="active:bg-surface-2 flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
                        >
                          <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="size-10" />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate font-semibold", active && "text-primary")}>
                              {r.name}
                            </span>
                            <span className="text-muted block truncate text-[0.8rem]">
                              {r.jobTitle ?? "Team member"}
                              {r.siteCode && ` · ${r.siteCode}`}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                              active
                                ? "border-primary bg-primary scale-110 text-white"
                                : "border-surface-3",
                            )}
                          >
                            {active && <Check className="size-3.5" strokeWidth={3.5} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          {sections.every((s) => s.people.length === 0) && (
            <p className="text-muted p-10 text-center text-sm">No one matches “{search}”.</p>
          )}
        </div>

        {/* Snapchat's send bar: chosen names + arrow. */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pb-safe fixed inset-x-0 bottom-0 z-40 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[36rem] md:-translate-x-1/2"
            >
              <div className="bg-primary flex items-center gap-3 px-4 py-3 text-white md:rounded-2xl">
                <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
                  {selectedPeople.map((r) => r.name).join(", ")}
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setStep("write");
                    setTimeout(() => textRef.current?.focus(), 250);
                  }}
                  aria-label="Next"
                  className="text-primary flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-lg"
                >
                  <ArrowRight className="size-6" strokeWidth={2.6} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- Step 2: compose ---------------- */}
      <div className={cn(step !== "write" && "hidden")}>
        <header className="glass pt-safe sticky top-0 z-30 -mx-4 px-4 md:mx-0 md:rounded-b-2xl">
          <div className="flex h-14 items-center">
            <button
              type="button"
              onClick={() => setStep("to")}
              className="-ml-1 px-1 text-[0.95rem] font-medium"
            >
              Back
            </button>
            <h1 className="flex-1 text-center text-[1.05rem] font-semibold tracking-tight">
              New shout-out
            </h1>
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-foreground text-background disabled:bg-surface-3 disabled:text-muted h-9 rounded-full px-4 text-sm font-bold transition-colors"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Post"}
            </button>
          </div>
        </header>

        <div className="flex gap-3 pt-3">
          {/* Thread rail */}
          <div className="flex w-10 shrink-0 flex-col items-center">
            <UserAvatar name={me.name} avatarUrl={me.avatarUrl} className="size-10" />
            <span className="bg-border mt-2 w-0.5 flex-1 rounded-full" />
          </div>

          <div className="min-w-0 flex-1 pb-6">
            <p className="font-semibold">{me.name}</p>
            <button
              type="button"
              onClick={() => setStep("to")}
              className="mt-1 flex max-w-full flex-wrap items-center gap-1.5 text-left"
            >
              <span className="text-muted text-xs font-semibold">to</span>
              {selectedPeople.map((r) => (
                <span
                  key={r.id}
                  className="bg-surface-2 inline-flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-0.5 text-[0.8rem] font-semibold"
                >
                  <UserAvatar name={r.name} avatarUrl={r.avatarUrl} className="size-6 text-[0.5rem]" />
                  {r.name}
                </span>
              ))}
            </button>

            <textarea
              ref={textRef}
              id="message"
              name="message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder={`What did ${firstNames[0] ?? "they"} do? Be specific, it hits harder.`}
              rows={3}
              maxLength={500}
              required
              className="placeholder:text-muted mt-3 block w-full resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none"
            />

            {/* Attachments */}
            {(images.length > 0 || uploadingCount > 0) && (
              <div className="no-scrollbar -mr-4 mt-2 flex gap-2 overflow-x-auto pr-4">
                {images.map((img) => (
                  <div key={img.url} className="relative h-40 w-32 shrink-0 overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.url)}
                      aria-label={`Remove ${img.name}`}
                      className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploadingCount }).map((_, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="bg-surface-2 flex h-40 w-32 shrink-0 items-center justify-center rounded-2xl"
                  >
                    <Loader2 className="text-muted size-5 animate-spin" />
                  </div>
                ))}
              </div>
            )}

            {/* Toolbar: photo · GIF · privacy · points */}
            <div className="text-muted mt-3 -ml-2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length + uploadingCount >= MAX_RECOGNITION_IMAGES}
                aria-label="Add a photo"
                className="hover:bg-surface-2 hover:text-foreground flex size-10 items-center justify-center rounded-full disabled:opacity-40"
              >
                <ImagePlus className="size-5.5" />
              </button>
              <GifPicker
                onSelect={addGif}
                disabled={images.length + uploadingCount >= MAX_RECOGNITION_IMAGES}
                triggerClassName="hover:bg-surface-2 hover:text-foreground flex size-10 items-center justify-center rounded-full disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setIsPrivate((p) => !p)}
                aria-pressed={isPrivate}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors",
                  isPrivate ? "bg-foreground text-background" : "hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {isPrivate ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
                {isPrivate ? "Private" : "Everyone"}
              </button>
              <button
                type="button"
                onClick={() => setKeypadOpen(true)}
                disabled={allowance.remaining === 0}
                className={cn(
                  "ml-auto flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold transition-colors disabled:opacity-40",
                  points > 0 ? "bg-lime text-lime-fg" : "bg-surface-2 text-foreground",
                )}
              >
                <span aria-hidden>✦</span>
                <span data-numeric>{points > 0 ? `+${pts(points)}` : "Add points"}</span>
              </button>
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
            {isPrivate && (
              <p className="text-muted mt-1 text-xs">
                Only you and {selected.length === 1 ? "them" : "the people you tagged"} will see it.
              </p>
            )}
          </div>
        </div>

        {/* Value */}
        <section className="mt-2 space-y-2.5">
          <h2 className="px-1 text-sm font-bold">
            Which value did they live? <span className="text-danger">*</span>
          </h2>
          <div className="flex flex-wrap gap-2">
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
                    "flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-all",
                    active ? "border-transparent text-white shadow-md" : "bg-surface text-foreground",
                  )}
                  style={
                    active
                      ? { backgroundColor: v.color ?? "var(--primary)" }
                      : { borderColor: tint(v.color, 0.35) }
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

        {/* Primary action in the thumb zone */}
        <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-[var(--background)] from-60% to-transparent px-4 pt-6 md:mx-0 md:px-0">
          <motion.button
            type="submit"
            disabled={!canSubmit}
            whileTap={{ scale: 0.98 }}
            className="bg-brand mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-[0_10px_30px_-8px_rgb(209_77_255/0.7)] disabled:opacity-40 disabled:shadow-none"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <span aria-hidden className="text-lg">👏</span>
            )}
            {pending
              ? "Sending…"
              : blocker ?? `Send to ${namesLabel}${points > 0 ? ` · +${pts(points)}` : ""}`}
          </motion.button>
        </div>
      </div>

      <PointsKeypad
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        value={points}
        onChange={setPoints}
        max={maxPerRecipient}
        people={Math.max(1, selected.length)}
        remaining={allowance.remaining}
        total={allowance.total}
      />
    </form>
  );
}

/** "Cian", "Cian & Saoirse", "Cian, Saoirse +2". */
function joinNames(names: string[]): string {
  return names.length <= 2
    ? names.join(" & ")
    : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

/** Runna / Duolingo-style "you did it" screen after a shout-out is sent. */
function Celebration({
  names,
  points,
  onDone,
  onAgain,
}: {
  names: string;
  points: number;
  onDone: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,rgb(124_92_255/0.45),transparent_60%),var(--background)] px-6 text-center">
      <Confetti />
      <motion.div
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="bg-brand flex size-32 items-center justify-center rounded-[2.5rem] text-7xl shadow-[0_20px_60px_-10px_rgb(209_77_255/0.8)]"
      >
        👏
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="font-display mt-8 text-4xl font-extrabold tracking-tight"
      >
        Sent!
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-muted mt-2 max-w-xs text-lg"
      >
        {names} {names.includes("&") || names.includes("+") ? "are" : "is"} going to love this.
      </motion.p>
      {points > 0 && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 15 }}
          data-numeric
          className="bg-lime text-lime-fg mt-5 rounded-full px-4 py-1.5 text-base font-extrabold"
        >
          +{pts(points)} each
        </motion.span>
      )}
      <div className="pb-safe absolute inset-x-0 bottom-0 mx-auto w-full max-w-md space-y-2 px-6 pb-6">
        <button
          type="button"
          onClick={onDone}
          className="bg-foreground text-background h-14 w-full rounded-full text-base font-bold transition-transform active:scale-[0.98]"
        >
          Back to feed
        </button>
        <button
          type="button"
          onClick={onAgain}
          className="h-12 w-full rounded-full text-base font-semibold"
        >
          Send another
        </button>
      </div>
    </div>
  );
}
