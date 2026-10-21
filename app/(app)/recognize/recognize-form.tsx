"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { upload } from "@vercel/blob/client";
import { uploadErrorMessage } from "@/lib/upload-error";
import { toast } from "sonner";
import {
  Check,
  Search,
  X,
  ImagePlus,
  Loader2,
  ChevronRight,
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
import type { GifResult } from "@/lib/recognition/gif";
import { GifPicker } from "@/components/recognize/gif-picker";
import { PointsKeypad } from "@/components/recognize/points-keypad";
import { Confetti } from "@/components/fx/confetti";
import { FramedAvatar } from "@/components/user-avatar";
import { ValueSeal } from "@/components/value-seal";
import { tint } from "@/components/value-chip";
import { pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type ValueOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
};
type RecipientOption = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  frame: string | null;
  siteCode: string;
};

/**
 * The Send flow, in the same plain Instagram pattern as the rest of the app:
 * 1. Who: a searchable people list with round checks and a Next button.
 * 2. New shout-out: the recipients up top, the message, the value as a grid
 *    of badges, then settings rows (photo, GIF, who can see it, points).
 * Points use the keypad sheet. Every step stays mounted inside one <form> so
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
  const [sent, setSent] = useState<{
    names: string;
    points: number;
    value: ValueOption | null;
  } | null>(null);
  // Celebrate (or toast the error) from inside the action, not an effect.
  const [, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    async (prev, fd) => {
      const res = await createRecognition(prev, fd);
      if (res.ok) {
        const names = fd
          .getAll("recipientIds")
          .map((id) => recipients.find((r) => r.id === String(id))?.name.split(" ")[0])
          .filter(Boolean) as string[];
        setSent({
          names: joinNames(names),
          points: Number(fd.get("points") ?? 0),
          value: values.find((v) => v.id === String(fd.get("valueId"))) ?? null,
        });
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
      } catch (error) {
        reservedRef.current = Math.max(0, reservedRef.current - 1);
        toast.error(`${file.name}: ${uploadErrorMessage(error, "upload failed.")}`);
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

  const byAllowance =
    selected.length > 0
      ? Math.floor(allowance.remaining / selected.length)
      : allowance.remaining;
  const maxPerRecipient =
    allowance.perShoutoutMax > 0 ? Math.min(byAllowance, allowance.perShoutoutMax) : byAllowance;

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

  // Sections: Recents, your site, then everyone A–Z. While searching, one list.
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
        value={sent.value}
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
        <header className="glass pt-safe border-border sticky top-0 z-30 -mx-4 border-b px-4 pb-3 md:mx-0">
          <div className="relative flex h-12 items-center justify-between">
            <Link href="/" aria-label="Close" className="-ml-1 flex size-10 items-center">
              <X className="size-6.5" />
            </Link>
            <h1 className="pointer-events-none absolute inset-x-0 text-center text-[1rem] font-bold">
              New shout-out
            </h1>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                setStep("write");
                setTimeout(() => textRef.current?.focus(), 250);
              }}
              className="text-primary relative text-[0.95rem] font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <div className="relative">
            <Search className="text-muted absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role or site"
              type="search"
              className="bg-surface-2 placeholder:text-muted h-10 w-full rounded-xl pr-4 pl-10 outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </header>

        {/* Chosen people, as tappable avatars (tap to remove). */}
        {selectedPeople.length > 0 && (
          <div className="no-scrollbar border-border -mx-4 flex gap-4 overflow-x-auto border-b px-4 py-3">
            {selectedPeople.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                aria-label={`Remove ${r.name}`}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span className="relative">
                  <FramedAvatar name={r.name} avatarUrl={r.avatarUrl} frame={r.frame} className="size-14" />
                  <span className="bg-surface-3 border-background absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2">
                    <X className="size-3" strokeWidth={3} />
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs">{r.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 pt-3 pb-32">
          {sections
            .filter((s) => s.people.length > 0)
            .map((section) => (
              <section key={section.title}>
                <h2 className="mb-1 text-[0.95rem] font-bold">{section.title}</h2>
                <ul>
                  {section.people.map((r) => {
                    const active = selected.includes(r.id);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          aria-pressed={active}
                          className="active:bg-surface-2 -mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-2 text-left transition-colors"
                        >
                          <FramedAvatar name={r.name} avatarUrl={r.avatarUrl} frame={r.frame} className="size-11 text-sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
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
                                ? "border-primary bg-primary text-white"
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

        {/* Next, in the thumb zone. */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pb-safe bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 backdrop-blur md:inset-x-auto md:left-1/2 md:w-[36rem] md:-translate-x-1/2"
            >
              <button
                type="button"
                onClick={() => {
                  setStep("write");
                  setTimeout(() => textRef.current?.focus(), 250);
                }}
                className="bg-primary text-primary-fg mb-3 flex h-12 w-full items-center justify-center rounded-xl text-[0.95rem] font-bold active:opacity-80"
              >
                Next · {namesLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- Step 2: compose ---------------- */}
      <div className={cn(step !== "write" && "hidden")}>
        <header className="glass pt-safe border-border sticky top-0 z-30 -mx-4 border-b px-4 md:mx-0">
          <div className="relative flex h-12 items-center justify-between">
            <button type="button" onClick={() => setStep("to")} className="relative text-[0.95rem]">
              Back
            </button>
            <h1 className="pointer-events-none absolute inset-x-0 text-center text-[1rem] font-bold">
              New shout-out
            </h1>
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-primary relative text-[0.95rem] font-bold disabled:opacity-40"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Share"}
            </button>
          </div>
        </header>

        {/* Who it's for: the same big, recipient-first header as the feed. */}
        <button
          type="button"
          onClick={() => setStep("to")}
          className="flex w-full items-center gap-3 pt-4 text-left"
        >
          <span className="flex shrink-0 items-center">
            {selectedPeople.slice(0, 3).map((r, i) => (
              <span key={r.id} className={cn(i > 0 && "-ml-4")} style={{ zIndex: 3 - i }}>
                <FramedAvatar name={r.name} avatarUrl={r.avatarUrl} frame={r.frame} className="size-11 text-sm" />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[1.05rem] font-bold tracking-tight">
              {selectedPeople.map((r) => r.name).join(", ")}
            </span>
            <span className="text-muted mt-0.5 block text-[0.82rem]">
              from <span className="text-foreground font-semibold">{me.name}</span>
            </span>
          </span>
          <ChevronRight className="text-muted size-5 shrink-0" />
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
          className="placeholder:text-muted mt-4 block w-full resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none"
        />

        {/* Attachments */}
        {(images.length > 0 || uploadingCount > 0) && (
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {images.map((img) => (
              <div key={img.url} className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl">
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
                className="bg-surface-2 flex h-40 w-32 shrink-0 items-center justify-center rounded-xl"
              >
                <Loader2 className="text-muted size-5 animate-spin" />
              </div>
            ))}
          </div>
        )}

        {/* Value: a grid of badges, the same ones shown on the post. */}
        <section className="border-border mt-4 border-t pt-4">
          <h2 className="text-[0.95rem] font-bold">
            Recognised for <span className="text-danger">*</span>
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {values.map((v) => {
              const active = valueId === v.id;
              return (
                <motion.button
                  key={v.id}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setValueId(active ? "" : v.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border-2 px-1.5 pt-3 pb-2.5 transition-colors",
                    active ? "" : "bg-surface border-transparent",
                  )}
                  style={
                    active
                      ? { borderColor: v.color ?? "var(--primary)", backgroundColor: tint(v.color, 0.12) }
                      : undefined
                  }
                >
                  <ValueSeal value={v} size="sm" ribbon={false} />
                  <span
                    className="line-clamp-2 text-center text-[0.78rem] leading-tight font-semibold"
                    style={active && v.color ? { color: v.color } : undefined}
                  >
                    {v.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Settings rows, like Instagram's "Tag people / Add location". */}
        <div className="border-border divide-border mt-4 divide-y border-y">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length + uploadingCount >= MAX_RECOGNITION_IMAGES}
            className="flex w-full items-center gap-3 py-3.5 text-left disabled:opacity-40"
          >
            <ImagePlus className="size-5.5" />
            <span className="flex-1">Add a photo</span>
            <ChevronRight className="text-muted size-4.5" />
          </button>
          <div className="relative flex items-center gap-3 py-3.5">
            <span className="flex size-5.5 items-center justify-center">
              <span className="rounded-[0.3rem] border-2 border-current px-0.5 text-[0.5rem] leading-tight font-black">
                GIF
              </span>
            </span>
            <span className="flex-1">Add a GIF</span>
            <ChevronRight className="text-muted size-4.5" />
            {/* The picker's own trigger covers the whole row. */}
            <GifPicker
              onSelect={addGif}
              disabled={images.length + uploadingCount >= MAX_RECOGNITION_IMAGES}
              triggerClassName="absolute inset-0 opacity-0 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            aria-pressed={isPrivate}
            className="flex w-full items-center gap-3 py-3.5 text-left"
          >
            {isPrivate ? <Lock className="size-5.5" /> : <Globe className="size-5.5" />}
            <span className="flex-1">Who can see it</span>
            <span className="text-muted text-[0.95rem]">{isPrivate ? "Only them" : "Everyone"}</span>
            <ChevronRight className="text-muted size-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setKeypadOpen(true)}
            disabled={allowance.remaining === 0}
            className="flex w-full items-center gap-3 py-3.5 text-left disabled:opacity-40"
          >
            <span aria-hidden className="text-primary flex size-5.5 items-center justify-center text-lg">
              ✦
            </span>
            <span className="flex-1">Points</span>
            <span data-numeric className={cn("text-[0.95rem]", points > 0 ? "text-primary font-bold" : "text-muted")}>
              {points > 0 ? `+${pts(points)} each` : `${pts(allowance.remaining)} left to give`}
            </span>
            <ChevronRight className="text-muted size-4.5" />
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
          <p className="text-muted mt-2 text-xs">
            Only you and {selected.length === 1 ? "them" : "the people you tagged"} will see it.
          </p>
        )}

        {/* Primary action in the thumb zone */}
        <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-[var(--background)] from-60% to-transparent px-4 pt-6 md:mx-0 md:px-0">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-primary text-primary-fg mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[0.95rem] font-bold active:opacity-80 disabled:opacity-40"
          >
            {pending && <Loader2 className="size-5 animate-spin" />}
            {pending
              ? "Sharing…"
              : blocker ?? `Share with ${namesLabel}${points > 0 ? ` · +${pts(points)}` : ""}`}
          </button>
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
        resetsIn={allowance.resetsIn}
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

/** The "sent" screen: the value's badge, who it went to, and the points. */
function Celebration({
  names,
  points,
  value,
  onDone,
  onAgain,
}: {
  names: string;
  points: number;
  value: ValueOption | null;
  onDone: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Confetti />
      <motion.div
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
      >
        {value ? (
          <ValueSeal value={value} size="lg" />
        ) : (
          <span className="bg-primary flex size-28 items-center justify-center rounded-full text-6xl">👏</span>
        )}
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-8 text-3xl font-extrabold tracking-tight"
      >
        Shared
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-muted mt-2 max-w-xs text-[1.05rem]"
      >
        {names} {names.includes("&") || names.includes("+") ? "are" : "is"} going to love this.
      </motion.p>
      {points > 0 && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 15 }}
          data-numeric
          className="bg-primary text-primary-fg mt-5 rounded-full px-4 py-1.5 text-base font-bold"
        >
          +{pts(points)} each
        </motion.span>
      )}
      <div className="pb-safe absolute inset-x-0 bottom-0 mx-auto w-full max-w-md space-y-2 px-6 pb-6">
        <button
          type="button"
          onClick={onDone}
          className="bg-primary text-primary-fg h-12 w-full rounded-xl text-[0.95rem] font-bold active:opacity-80"
        >
          Back to feed
        </button>
        <button type="button" onClick={onAgain} className="h-12 w-full rounded-xl text-[0.95rem] font-semibold">
          Send another
        </button>
      </div>
    </div>
  );
}
