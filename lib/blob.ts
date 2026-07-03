/**
 * Vercel Blob helpers shared by everything that stores an uploaded image URL
 * (recognition attachments, user avatars).
 *
 * URLs are pinned to THIS project's Blob store so a crafted submission can't
 * slip in an arbitrary public blob (another user's — or another Vercel tenant's,
 * since every store shares the `*.public.blob.vercel-storage.com` suffix and all
 * public blobs are world-readable). The store's public host is
 * `<storeId>.public.blob.vercel-storage.com`, and the storeId is the segment of
 * BLOB_READ_WRITE_TOKEN (`vercel_blob_rw_<storeId>_<secret>`). When no token is
 * configured (local dev without Blob), fall back to accepting any Vercel Blob
 * public host.
 */
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function expectedBlobHost(): string | null {
  const storeId =
    process.env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1] ??
    process.env.BLOB_STORE_ID;
  return storeId ? `${storeId.toLowerCase()}${BLOB_HOST_SUFFIX}` : null;
}

/** True if `value` is an https URL on this project's Vercel Blob store. */
export function isProjectBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const expected = expectedBlobHost();
    return expected ? host === expected : host.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}
