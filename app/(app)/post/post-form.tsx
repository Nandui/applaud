"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Globe, ImagePlus, Loader2, X } from "lucide-react";
import { createPost, type ActionResult } from "@/lib/recognition/actions";
import { ALLOWED_IMAGE_TYPES, MAX_POST_LENGTH } from "@/lib/config";
import type { FrameArt } from "@/lib/cosmetics";
import { GifPicker } from "@/components/recognize/gif-picker";
import { useAttachments } from "@/components/recognize/use-attachments";
import { AttachmentStrip } from "@/components/recognize/attachment-strip";
import { FramedAvatar } from "@/components/user-avatar";
import { PostBanner } from "@/components/feed/post-banner";

/**
 * New post: the plain Instagram composer. Your name up top, what you want to
 * say, then photo and GIF rows. No recipients, value or points, which is
 * what makes it a post rather than a shout-out. Without a picture the post
 * shows on your own banner from the profile shop.
 */
export function PostForm({
  me,
}: {
  me: { name: string; avatarUrl: string | null; frame: FrameArt | null; banner: string };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { images, uploadingCount, full, handleFiles, removeImage, addGif } = useAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    async (prev, fd) => {
      const res = await createPost(prev, fd);
      if (res.ok) {
        toast.success("Posted to the feed");
        router.push("/");
      } else {
        toast.error(res.error);
      }
      return res;
    },
    undefined,
  );

  const text = message.trim();
  const canSubmit = (text.length > 0 || images.length > 0) && !pending && uploadingCount === 0;
  const nearLimit = message.length > MAX_POST_LENGTH - 100;

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      {images.map((img) => (
        <input key={img.url} type="hidden" name="imageUrls" value={img.url} />
      ))}

      <header className="glass pt-safe border-border sticky top-0 z-30 -mx-4 border-b px-4 md:mx-0">
        <div className="relative flex h-12 items-center justify-between">
          <Link href="/" aria-label="Close" className="-ml-1 flex size-10 items-center">
            <X className="size-6.5" />
          </Link>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[1rem] font-bold">
            New post
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

      <div className="flex items-center gap-3 pt-4">
        <FramedAvatar name={me.name} avatarUrl={me.avatarUrl} frame={me.frame} className="size-11 text-sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[1.05rem] font-bold tracking-tight">{me.name}</span>
          <span className="text-muted mt-0.5 flex items-center gap-1 text-[0.82rem]">
            <Globe className="size-3.5" /> Everyone can see it
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
        placeholder="What's going on? Share news, a win, a photo from the shift…"
        rows={4}
        maxLength={MAX_POST_LENGTH}
        className="placeholder:text-muted mt-4 block w-full resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none"
      />
      {nearLimit && (
        <p data-numeric className="text-muted text-right text-xs">
          {message.length}/{MAX_POST_LENGTH}
        </p>
      )}

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
        Want to thank someone? <Link href="/recognize" className="text-primary font-semibold">Send a shout-out</Link>{" "}
        instead, so it counts for them.
      </p>

      <div className="pb-safe sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-[var(--background)] from-60% to-transparent px-4 pt-6 md:mx-0 md:px-0">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-primary text-primary-fg mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[0.95rem] font-bold active:opacity-80 disabled:opacity-40"
        >
          {pending && <Loader2 className="size-5 animate-spin" />}
          {pending ? "Sharing…" : canSubmit || uploadingCount > 0 ? "Share" : "Write something or add a photo"}
        </button>
      </div>
    </form>
  );
}
