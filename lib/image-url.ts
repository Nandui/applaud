/**
 * Uploads (avatars, banners, frames, photos) are stored as people sent them,
 * up to 8 MB each, but are mostly drawn small: a phone photo used as an
 * avatar is shown at 36px. This routes Vercel Blob pictures through Next's
 * image optimiser (/_next/image), which resizes them, converts them to WebP
 * and caches the result at the edge, so a screen downloads kilobytes instead
 * of megabytes. Anything else (GIPHY GIFs, CSS gradients, local files) is
 * left alone. Animated GIFs come back unchanged from the optimiser.
 *
 * Widths must be one of next.config.ts `images` sizes (the defaults); they
 * are CSS pixels, doubled here for sharp phone screens.
 */

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** Default Next image sizes, smallest first: what /_next/image accepts as `w`. */
const ALLOWED_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

function isBlobUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.toLowerCase().endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** A resized copy of `src` for drawing at `cssWidth` CSS pixels (2x for retina). */
export function optimizedImage(src: string, cssWidth: number): string {
  if (!isBlobUrl(src)) return src;
  const want = cssWidth * 2;
  const w = ALLOWED_WIDTHS.find((x) => x >= want) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
}

/**
 * The same, made safe to put inside CSS `url("…")`. An optimised URL is
 * already percent-encoded (encoding it again would break it); anything else
 * is encoded as before.
 */
export function cssImageUrl(src: string, cssWidth: number): string {
  const out = optimizedImage(src, cssWidth);
  return out === src ? encodeURI(src) : out;
}
