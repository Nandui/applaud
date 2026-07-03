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
