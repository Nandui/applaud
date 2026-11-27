/**
 * GIF-library (GIPHY) search support for recognition attachments.
 *
 * A picked GIF is stored as just another URL in `Recognition.imageUrls`, so it
 * renders through the same feed path as uploaded photos. This module is shared
 * by the search route (server), the create action (server, to allow GIPHY hosts
 * past attachment validation), and the picker (client) — it has no server-only
 * imports so it is safe on both sides.
 */

/** One search hit, shaped for the picker grid and for storing in `imageUrls`. */
export type GifResult = {
  id: string;
  /** Small animated rendition shown in the picker grid. */
  previewUrl: string;
  /** Rendition stored in `imageUrls` and rendered in the feed. */
  url: string;
  width: number;
  height: number;
  title: string;
};

const GIPHY_HOST_SUFFIX = ".giphy.com";

/**
 * True for an https GIPHY media URL — i.e. what our search route returns
 * (`media*.giphy.com`, `i.giphy.com`, …). Used to let a searched GIF's URL past
 * the attachment allow-list without opening it up to arbitrary remote images.
 */
export function isGiphyMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "giphy.com" || host.endsWith(GIPHY_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * GIPHY serves every GIF at fixed paths next to each other
 * (`…/media/<id>/200.gif`, `…/200w.webp`, `…/giphy.webp`, …), so a stored URL
 * of any rendition can be turned into any other one.
 *
 * - `"large"`: the original size as WebP (`giphy.webp`). Full colour, unlike
 *   GIF's 256-colour dithered palette, and smaller than the original GIF.
 *   Used for the big feed picture and comment GIFs.
 * - `"thumb"`: 200px wide WebP (`200w.webp`), for the picker grid.
 *
 * Anything that is not a GIPHY media URL comes back unchanged.
 */
export type GiphySize = "large" | "thumb";

const GIPHY_FILES: Record<GiphySize, string> = {
  large: "giphy.webp",
  thumb: "200w.webp",
};

/** A rendition file name, e.g. `200.gif`, `giphy-downsized.gif`, `100w.webp`. */
const RENDITION_FILE = /^[\w-]+\.(gif|webp|mp4)$/i;

export function giphyRendition(value: string, size: GiphySize): string {
  if (!isGiphyMediaUrl(value)) return value;
  const url = new URL(value);
  const parts = url.pathname.split("/");
  const file = parts[parts.length - 1];
  // Only `/media/…/<id>/<file>` paths: leave anything else alone.
  if (!parts.includes("media") || parts.length < 4 || !RENDITION_FILE.test(file)) return value;
  const next = GIPHY_FILES[size];
  if (file === next) return value;
  parts[parts.length - 1] = next;
  url.pathname = parts.join("/");
  // `rid` names the rendition for GIPHY's analytics; keep it in step.
  if (url.searchParams.has("rid")) url.searchParams.set("rid", next);
  return url.toString();
}

/**
 * `onError` for an <img> showing a GIPHY rendition: if that rendition is
 * missing, fall back once to the URL we stored (which we know exists).
 */
export function fallBackTo(stored: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget;
    if (img.dataset.fellBack || img.src === stored) return;
    img.dataset.fellBack = "1";
    img.src = stored;
  };
}
