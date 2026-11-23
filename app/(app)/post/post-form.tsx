"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronRight,
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  MessageCircleQuestion,
  PenLine,
  Plus,
  X,
} from "lucide-react";
import { createPost, type ActionResult } from "@/lib/recognition/actions";
import { createPoll, createQuestion } from "@/lib/posts/actions";
import {
  DEFAULT_POLL_HOURS,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  QUESTION_MAX_LENGTH,
} from "@/lib/posts/kinds";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ALLOWED_IMAGE_TYPES, MAX_POST_LENGTH } from "@/lib/config";
import type { FrameArt } from "@/lib/cosmetics";
import { GifPicker } from "@/components/recognize/gif-picker";
import { useAttachments } from "@/components/recognize/use-attachments";
import { AttachmentStrip } from "@/components/recognize/attachment-strip";
import { FramedAvatar } from "@/components/user-avatar";
import { PostBanner } from "@/components/feed/post-banner";

export type ComposerType = "post" | "poll" | "question";

const TYPES: { id: ComposerType; label: string; icon: typeof PenLine; title: string }[] = [
  { id: "post", label: "Post", icon: PenLine, title: "New post" },
  { id: "poll", label: "Poll", icon: BarChart3, title: "New poll" },
  { id: "question", label: "Question", icon: MessageCircleQuestion, title: "New question" },
];

/**
 * New post: the plain Instagram composer. Your name up top, what you want to
 * say, then photo and GIF rows. No recipients, value or points, which is
 * what makes it a post rather than a shout-out. Without a picture the post
 * shows on your own banner from the profile shop.
 *
 * Managers and up (and admins) also get Poll and Question tabs: a poll has
 * 2 to 6 choices everyone can vote on; a question takes private answers that
 * only the asker can read.
 */
export function PostForm({
  me,
  canAsk,
  initialType,
  sites,
}: {
  me: { name: string; avatarUrl: string | null; frame: FrameArt | null; banner: string };
  canAsk: boolean;
  initialType: ComposerType;
  sites: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<ComposerType>(initialType);
  const [message, setMessage] = useState("");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [hours, setHours] = useState<number>(DEFAULT_POLL_HOURS);
  const [showResults, setShowResults] = useState(true);
  // Polls and questions: the sites that see it; none picked = everyone.
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const { images, uploadingCount, full, handleFiles, removeImage, addGif } = useAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    async (prev, fd) => {
      const res =
        type === "poll"
          ? await createPoll(prev, fd)
          : type === "question"
            ? await createQuestion(prev, fd)
            : await createPost(prev, fd);
      if (res.ok) {
        toast.success(
          type === "poll" ? "Poll posted" : type === "question" ? "Question posted" : "Posted to the feed",
        );
        router.push("/");
      } else {
        toast.error(res.error);
      }
      return res;
    },
    undefined,
  );

  const text = message.trim();
  const filledChoices = choices.map((c) => c.trim()).filter(Boolean);
  const isAsk = type !== "post";
  const maxLength = isAsk ? QUESTION_MAX_LENGTH : MAX_POST_LENGTH;
  const ready =
    type === "post"
      ? (text.length > 0 || images.length > 0) && uploadingCount === 0
      : type === "poll"
        ? text.length >= 3 && filledChoices.length >= POLL_MIN_OPTIONS
        : text.length >= 3;
  const canSubmit = ready && !pending;
  const nearLimit = message.length > maxLength - (isAsk ? 50 : 100);
  const current = TYPES.find((t) => t.id === type) ?? TYPES[0];
  const hint =
    type === "post"
      ? "Write something or add a photo"
      : type === "poll"
        ? text.length < 3
          ? "Write your question"
          : `Add at least ${POLL_MIN_OPTIONS} choices`
        : "Write your question";

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      {type === "post" &&
        images.map((img) => <input key={img.url} type="hidden" name="imageUrls" value={img.url} />)}
      {type !== "post" &&
        siteIds.map((id) => <input key={id} type="hidden" name="siteIds" value={id} />)}
      {type === "poll" && (
        <>
          <input type="hidden" name="hours" value={hours} />
          {showResults && <input type="hidden" name="showResults" value="on" />}
        </>
      )}

      <header className="glass pt-safe border-border sticky top-0 z-30 -mx-4 border-b px-4 md:mx-0">
        <div className="relative flex h-12 items-center justify-between">
          <Link href="/" aria-label="Close" className="-ml-1 flex size-10 items-center">
            <X className="size-6.5" />
          </Link>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[1rem] font-bold">
            {current.title}
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

      {canAsk && (
        <div role="tablist" aria-label="What to share" className="bg-surface-2 mt-3 grid grid-cols-3 gap-1 rounded-xl p-1">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setType(t.id)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors",
                  on ? "bg-background text-foreground shadow-sm" : "text-muted",
                )}
              >
                <Icon className={cn("size-4", on && "text-primary")} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 pt-4">
        <FramedAvatar name={me.name} avatarUrl={me.avatarUrl} frame={me.frame} className="size-11 text-sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[1.05rem] font-bold tracking-tight">{me.name}</span>
          <span className="text-muted mt-0.5 flex items-center gap-1 text-[0.82rem]">
            {type !== "post" && siteIds.length > 0 ? (
              <>
                <MapPin className="size-3.5" />{" "}
                <span className="truncate">
                  Only {siteNames(siteIds, sites)}
                </span>
              </>
            ) : type === "question" ? (
              <>
                <Lock className="size-3.5" /> Only you see the answers
              </>
            ) : (
              <>
                <Globe className="size-3.5" /> Everyone can see it
              </>
            )}
          </span>
        </span>
      </div>

      <textarea
        name="message"
        value={message}
        autoFocus
        onChange={(e) => {
          setMessage(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        placeholder={
          type === "poll"
            ? "Ask a question… e.g. Which day suits the team night out?"
            : type === "question"
              ? "Ask the team… e.g. What's one thing that would make your shift easier?"
              : "What's going on? Share news, a win, a photo from the shift…"
        }
        rows={isAsk ? 2 : 4}
        maxLength={maxLength}
        className="placeholder:text-muted mt-4 block w-full resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none"
      />
      {nearLimit && (
        <p data-numeric className="text-muted text-right text-xs">
          {message.length}/{maxLength}
        </p>
      )}

      {type === "poll" && (
        <PollEditor
          choices={choices}
          setChoices={setChoices}
          hours={hours}
          setHours={setHours}
          showResults={showResults}
          setShowResults={setShowResults}
        />
      )}

      {type === "question" && (
        <div className="mt-2">
          {text.length > 0 && (
            <>
              <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Preview</p>
              <PostBanner
                banner={me.banner}
                message={text}
                className="aspect-[2/1] min-h-44 rounded-2xl py-6"
                label={
                  <>
                    <MessageCircleQuestion className="size-3.5" /> Question
                  </>
                }
              />
            </>
          )}
          <div className="bg-surface-2 mt-4 flex gap-3 rounded-2xl px-4 py-3.5">
            <Lock className="text-primary mt-0.5 size-5 shrink-0" />
            <p className="text-[0.9rem] leading-snug">
              <span className="font-semibold">Answers are private.</span>{" "}
              <span className="text-muted">
                Everyone can answer in the feed, but only you can read what they write. Nobody else sees the
                answers, not even admins.
              </span>
            </p>
          </div>
        </div>
      )}

      {type !== "post" && sites.length > 1 && (
        <SitePicker sites={sites} picked={siteIds} setPicked={setSiteIds} />
      )}

      {type === "post" && (
      <>
      <AttachmentStrip images={images} uploadingCount={uploadingCount} onRemove={removeImage} />

      {/* No picture: preview it on your banner, the way the feed will show it. */}
      {images.length === 0 && uploadingCount === 0 && text.length > 0 && (
        <div className="mt-4">
          <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Preview</p>
          <PostBanner banner={me.banner} message={text} className="rounded-2xl" />
        </div>
      )}

      <div className="border-border divide-border mt-4 divide-y border-y">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={full}
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
            disabled={full}
            triggerClassName="absolute inset-0 opacity-0 disabled:cursor-not-allowed"
          />
        </div>
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

      <p className="text-muted mt-3 text-xs">
        Want to thank someone? <Link href="/recognize" className="text-primary font-semibold">Recognize someone</Link>{" "}
        instead, so it counts for them.
      </p>
      </>
      )}

      <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-[var(--background)] from-60% to-transparent px-4 pt-6 md:mx-0 md:px-0">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-primary text-primary-fg mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[0.95rem] font-bold active:opacity-80 disabled:opacity-40"
        >
          {pending && <Loader2 className="size-5 animate-spin" />}
          {pending ? "Sharing…" : canSubmit || (type === "post" && uploadingCount > 0) ? "Share" : hint}
        </button>
      </div>
    </form>
  );
}

/** The poll part of the composer: choices, how long it runs, who sees results. */
function PollEditor({
  choices,
  setChoices,
  hours,
  setHours,
  showResults,
  setShowResults,
}: {
  choices: string[];
  setChoices: (next: string[]) => void;
  hours: number;
  setHours: (h: number) => void;
  showResults: boolean;
  setShowResults: (v: boolean) => void;
}) {
  return (
    <div className="mt-2 space-y-5">
      <div>
        <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Choices</p>
        <ul className="space-y-2">
          {choices.map((c, i) => (
            <li key={i} className="relative">
              <input
                name="options"
                value={c}
                onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={POLL_OPTION_MAX_LENGTH}
                placeholder={`Choice ${i + 1}${i >= POLL_MIN_OPTIONS ? " (optional)" : ""}`}
                aria-label={`Choice ${i + 1}`}
                className="border-border focus:border-primary placeholder:text-muted h-12 w-full rounded-xl border bg-transparent px-4 pr-11 text-[0.95rem] outline-none"
              />
              {choices.length > POLL_MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => setChoices(choices.filter((_, j) => j !== i))}
                  aria-label={`Remove choice ${i + 1}`}
                  className="text-muted absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  <X className="size-4.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {choices.length < POLL_MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setChoices([...choices, ""])}
            className="text-primary mt-2 flex h-10 items-center gap-1.5 text-sm font-semibold"
          >
            <Plus className="size-4.5" /> Add a choice
          </button>
        )}
      </div>

      <div>
        <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Poll length</p>
        <div className="flex flex-wrap gap-2">
          {POLL_DURATIONS.map((d) => (
            <button
              key={d.hours}
              type="button"
              onClick={() => setHours(d.hours)}
              aria-pressed={hours === d.hours}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
                hours === d.hours ? "border-primary bg-primary text-primary-fg" : "border-border",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <label className="border-border flex items-center gap-3 border-y py-3.5">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[0.95rem] font-semibold">Show results after voting</span>
          <span className="text-muted mt-0.5 block text-[0.82rem]">
            {showResults
              ? "People see how everyone voted once they vote. Votes are anonymous."
              : "Only you see the results. Votes are anonymous."}
          </span>
        </span>
        <Switch checked={showResults} onCheckedChange={(v) => setShowResults(Boolean(v))} />
      </label>
    </div>
  );
}

function siteNames(ids: string[], sites: { id: string; name: string }[]): string {
  const names = sites.filter((s) => ids.includes(s.id)).map((s) => s.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Who sees a poll or question: everyone, or only people at the picked sites. */
function SitePicker({
  sites,
  picked,
  setPicked,
}: {
  sites: { id: string; name: string }[];
  picked: string[];
  setPicked: (next: string[]) => void;
}) {
  const everyone = picked.length === 0;
  const chip = (on: boolean) =>
    cn(
      "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
      on ? "border-primary bg-primary text-primary-fg" : "border-border",
    );
  return (
    <div className="mt-5">
      <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Who can see it</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicked([])} aria-pressed={everyone} className={chip(everyone)}>
          Everyone
        </button>
        {sites.map((s) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(on ? picked.filter((id) => id !== s.id) : [...picked, s.id])}
              className={chip(on)}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      <p className="text-muted mt-2 text-[0.82rem]">
        {everyone
          ? "Everyone in every site sees it. Pick sites to limit it to the people there."
          : `Only people at ${siteNames(picked, sites)} see it. Admins can always see it.`}
      </p>
    </div>
  );
}
