"use client";

import { Loader2, X } from "lucide-react";
import type { Attachment } from "./use-attachments";

/** The picked photos and GIFs as a sideways strip, with uploads still in flight. */
export function AttachmentStrip({
  images,
  uploadingCount,
  onRemove,
}: {
  images: Attachment[];
  uploadingCount: number;
  onRemove: (url: string) => void;
}) {
  if (images.length === 0 && uploadingCount === 0) return null;
  return (
    <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
      {images.map((img) => (
        <div key={img.url} className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(img.url)}
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
  );
}
