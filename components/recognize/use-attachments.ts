"use client";

import { useRef, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { toast } from "sonner";
import { uploadErrorMessage } from "@/lib/upload-error";
import {
  MAX_RECOGNITION_IMAGES,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/config";
import type { GifResult } from "@/lib/recognition/gif";

export type Attachment = { url: string; name: string };

/**
 * Photos and GIFs attached to a shout-out or a post: uploads straight to Blob
 * from the browser, GIFs picked from the library, and the shared cap.
 */
export function useAttachments() {
  // Uploaded image attachments (Vercel Blob public URLs) + in-flight uploads.
  const [images, setImages] = useState<Attachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
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
        const blob = await uploadPresigned(`recognitions/${file.name}`, file, {
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

  function clear() {
    setImages([]);
    reservedRef.current = 0;
  }

  const full = images.length + uploadingCount >= MAX_RECOGNITION_IMAGES;

  return { images, uploadingCount, full, handleFiles, removeImage, addGif, clear };
}
