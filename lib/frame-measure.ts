import { detectFrameFit, type FrameFit } from "@/lib/frame-fit";

/** Measure at most this many pixels across: plenty to find the hole, quick on phones. */
const MAX_SIDE = 256;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that picture."));
    img.src = src;
  });
}

/**
 * Browser only: auto-fit a frame picture (see detectFrameFit). Takes a file
 * being uploaded, or the URL of one already in our Blob store, which is read
 * through /api/admin/store/frame-image so the canvas can see its pixels.
 * Animated GIFs are measured on their first frame. Null if it can't tell.
 */
export async function measureFrame(source: File | string): Promise<FrameFit | null> {
  const src =
    typeof source === "string"
      ? `/api/admin/store/frame-image?url=${encodeURIComponent(source.split("#")[0])}`
      : URL.createObjectURL(source);
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return detectFrameFit(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(src);
  }
}
