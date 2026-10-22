import { createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * Google profile pictures as the default Yayup avatar.
 *
 * On each Google sign-in, if the person has no avatar yet, or the one they
 * have is still a copy of their Google picture, we copy the Google picture
 * into our own Blob store and make it their avatar. A picture they (or an
 * admin) uploaded is never touched.
 *
 * We copy rather than link because Google's URLs can change or expire, and
 * only our Blob pictures go through the image optimiser (lib/image-url.ts).
 *
 * Copies live at `avatars/google/<userId>-<key>.<ext>`, where `key` is a hash
 * of Google's picture URL. The path alone says "this is the Google copy" and
 * "which Google picture it was", so no extra column is needed: a sign-in with
 * an unchanged Google picture does nothing at all.
 */

const GOOGLE_DIR = "avatars/google/";

/** Google's picture URL asks for 96px; ask for 512px instead (sharp on profiles). */
export function largerGooglePicture(url: string): string {
  return url.replace(/=s\d+(-c)?$/, "=s512-c");
}

/** Short stable id for one Google picture URL. */
export function googlePictureKey(pictureUrl: string): string {
  return createHash("sha256").update(pictureUrl).digest("hex").slice(0, 16);
}

function blobPath(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/^\//, "");
  } catch {
    return null;
  }
}

/** True if `avatarUrl` is the copy of this person's Google picture we made. */
export function isGoogleAvatar(avatarUrl: string, userId: string): boolean {
  return blobPath(avatarUrl)?.startsWith(`${GOOGLE_DIR}${userId}-`) ?? false;
}

/**
 * What to do with someone's avatar given their Google picture:
 * "copy" (none yet, or an older Google copy) or "keep" (their own upload,
 * or already the current Google picture).
 */
export function googleAvatarAction(
  avatarUrl: string | null,
  userId: string,
  pictureUrl: string,
): "copy" | "keep" {
  if (!avatarUrl) return "copy";
  if (!isGoogleAvatar(avatarUrl, userId)) return "keep";
  const current = blobPath(avatarUrl)?.startsWith(
    `${GOOGLE_DIR}${userId}-${googlePictureKey(pictureUrl)}.`,
  );
  return current ? "keep" : "copy";
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Bring the person's avatar in line with their Google picture (see above).
 * Never throws: a failure only means they keep what they had, so sign-in
 * must not depend on it.
 */
export async function syncGoogleAvatar(
  user: { id: string; avatarUrl: string | null },
  picture: unknown,
): Promise<void> {
  if (typeof picture !== "string" || !picture.startsWith("https://")) return;
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return;
  if (googleAvatarAction(user.avatarUrl, user.id, picture) === "keep") return;

  try {
    const res = await fetch(largerGooglePicture(picture), {
      signal: AbortSignal.timeout(4000),
    });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) return;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return;

    const blob = await put(
      `${GOOGLE_DIR}${user.id}-${googlePictureKey(picture)}.${EXTENSIONS[type]}`,
      bytes,
      { access: "public", contentType: type, addRandomSuffix: false, allowOverwrite: true },
    );

    // Only if the avatar is still what we read: an upload made meanwhile wins.
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, avatarUrl: user.avatarUrl },
      data: { avatarUrl: blob.url },
    });
    if (count === 0) return;
    if (user.avatarUrl && user.avatarUrl !== blob.url) {
      await del(user.avatarUrl).catch(() => {});
    }
  } catch (error) {
    console.error("Copying the Google profile picture failed:", error);
  }
}
