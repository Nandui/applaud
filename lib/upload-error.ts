/**
 * Turns a failed `@vercel/blob/client` upload into a message an admin can act
 * on. The SDK swallows our token route's error body and throws a generic
 * "Failed to retrieve the client token", and Blob's own errors arrive as
 * "Vercel Blob: <reason>", so a bare "upload failed" toast hid the cause.
 */
export function uploadErrorMessage(error: unknown, fallback = "Picture upload failed."): string {
  const raw = error instanceof Error ? error.message : "";
  const message = raw.replace(/^Vercel Blob:\s*/i, "").trim();
  if (!message) return fallback;

  if (/client token|presigned url/i.test(message)) {
    return "The server refused the upload. Check you're still signed in, and that a Blob store is connected to this Vercel project (then redeploy).";
  }
  if (/private/i.test(message) && /public|access/i.test(message)) {
    return "The Blob store connected to this app is private. Pictures need a public Blob store: create one in Vercel > Storage, connect it to the project, then redeploy.";
  }
  if (/content type|not allowed/i.test(message)) return "Use a PNG, JPG, GIF, or WebP.";
  if (/too large|maximum size|exceeds/i.test(message)) return "That picture is too big. Keep it under 8MB.";
  return `${fallback} ${message}`;
}
