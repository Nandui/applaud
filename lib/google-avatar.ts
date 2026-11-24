import { createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * Google profile pictures as the default Yayup avatar.
 *
 * On EVERY Google sign-in, if the person has no avatar, or the one they have
 * is still their Google picture, it is brought up to date with the picture
 * Google sends. A picture they (or an admin) uploaded is never touched, and
 * removing your own upload brings the Google picture back on the next sign-in.
 *
 * Preferably we copy the picture into our own Blob store: Google's URLs can
 * change, and only Blob pictures go through the image optimiser
 * (lib/image-url.ts). Copies live at `avatars/google/<userId>-<key>.<ext>`,
 * where `key` is a hash of Google's picture URL, so the path alone says "this
 * is the Google copy" and "which Google picture it was": a sign-in with an
 * unchanged Google picture does nothing at all.
 *
 * If the copy can't be made (Google slow to answer, Blob refusing, an odd
 * file type), the avatar points straight at Google's picture instead, so the
 * person still gets their photo; the next sign-in tries the copy again. Every
 * reason a sign-in leaves the avatar alone is logged, for the Vercel Logs tab.
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

/** True for a profile picture served by Google itself (lh3.googleusercontent.com …). */
export function isGooglePictureUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^lh\d+\.googleusercontent\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function blobPath(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/^\//, "");
  } catch {
    return null;
  }
}

/** True if `avatarUrl` is the Blob copy of this person's Google picture we made. */
export function isGoogleAvatar(avatarUrl: string, userId: string): boolean {
  return blobPath(avatarUrl)?.startsWith(`${GOOGLE_DIR}${userId}-`) ?? false;
}

/**
 * What to do with someone's avatar given their Google picture:
 * "copy" (none yet, an older Google copy, or a direct link to Google that we
 * now try to copy) or "keep" (their own upload, or already the current copy).
 */
export function googleAvatarAction(
  avatarUrl: string | null,
  userId: string,
  pictureUrl: string,
): "copy" | "keep" {
  if (!avatarUrl) return "copy";
  if (isGooglePictureUrl(avatarUrl)) return "copy";
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

/** Copy Google's picture into Blob; the copy's URL, or why it couldn't be made. */
async function copyToBlob(
  userId: string,
  picture: string,
): Promise<{ url: string } | { reason: string; status?: number }> {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return { reason: "no Blob store is connected (BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN)" };
  }
  try {
    const res = await fetch(largerGooglePicture(picture), {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "image/jpeg,image/png,image/webp,image/gif" },
    });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok) return { reason: `Google answered ${res.status}`, status: res.status };
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type) || !EXTENSIONS[type]) {
      return { reason: `Google sent an unexpected file type "${type}"` };
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return { reason: `Google sent ${bytes.byteLength} bytes` };
    }
    const blob = await put(
      `${GOOGLE_DIR}${userId}-${googlePictureKey(picture)}.${EXTENSIONS[type]}`,
      bytes,
      { access: "public", contentType: type, addRandomSuffix: false, allowOverwrite: true },
    );
    return { url: blob.url };
  } catch (error) {
    return { reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

/**
 * True if the picture at `url` still loads. A Blob copy can have been
 * deleted and a Google link can go stale; either way the avatar falls back to
 * initials although the person "has" a picture. Network trouble counts as
 * loading, so a slow moment never replaces anyone's picture.
 */
export async function pictureLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000), cache: "no-store" });
    return res.ok || res.status === 405;
  } catch {
    return true;
  }
}

export type GoogleAvatarOutcome =
  /** The avatar is now the Google picture. */
  | "updated"
  /** Nothing to do: their own picture, or already the current Google copy. */
  | "unchanged"
  /** Google no longer serves this picture link: a fresh sign-in brings a new one. */
  | "stale"
  | "failed";

/**
 * Bring the person's avatar in line with their Google picture (see above).
 * `force` replaces whatever they have, their own upload too (they asked for
 * it, or what they have doesn't load). Without it a current Google copy is
 * still checked, and copied again if it has gone missing.
 * Never throws: a failure only means they keep what they had, so sign-in
 * must not depend on it.
 */
export async function setGoogleAvatar(
  user: { id: string; avatarUrl: string | null },
  picture: unknown,
  { force = false }: { force?: boolean } = {},
): Promise<GoogleAvatarOutcome> {
  try {
    if (typeof picture !== "string" || !picture.startsWith("https://")) {
      console.warn(`No Google profile picture for user ${user.id}; avatar left as it was.`);
      return "failed";
    }
    const action = googleAvatarAction(user.avatarUrl, user.id, picture);
    if (action === "keep" && user.avatarUrl) {
      const isCurrentCopy = isGoogleAvatar(user.avatarUrl, user.id);
      if (!isCurrentCopy && !force) return "unchanged";
      if (await pictureLoads(user.avatarUrl)) {
        if (isCurrentCopy) return "unchanged";
      } else {
        console.warn(`The avatar of user ${user.id} no longer loads; replacing it with the Google picture.`);
      }
    }

    const copy = await copyToBlob(user.id, picture);
    let next: string;
    if ("url" in copy) {
      next = copy.url;
    } else if (copy.status === 404 || copy.status === 403 || copy.status === 410) {
      // Linking to a picture Google no longer serves would only show initials.
      console.warn(`Google no longer serves the saved profile picture of user ${user.id} (${copy.reason}).`);
      return "stale";
    } else {
      console.warn(
        `Copying the Google profile picture of user ${user.id} failed (${copy.reason}); linking to Google's picture instead.`,
      );
      next = largerGooglePicture(picture);
    }
    if (next === user.avatarUrl) return "unchanged";

    // Only if the avatar is still what we read: an upload made meanwhile wins.
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, avatarUrl: user.avatarUrl },
      data: { avatarUrl: next },
    });
    if (count === 0) return "unchanged";
    // Tidy up the older Google copy it replaced (never anything else).
    if (user.avatarUrl && isGoogleAvatar(user.avatarUrl, user.id) && user.avatarUrl !== next) {
      await del(user.avatarUrl).catch(() => {});
    }
    return "updated";
  } catch (error) {
    console.error(`Setting the Google profile picture of user ${user.id} failed:`, error);
    return "failed";
  }
}

/** Sign-in: true if the avatar changed. */
export async function syncGoogleAvatar(
  user: { id: string; avatarUrl: string | null },
  picture: unknown,
): Promise<boolean> {
  return (await setGoogleAvatar(user, picture)) === "updated";
}

/** The `picture` claim of a Google ID token (no signature check: we stored it ourselves). */
export function pictureFromIdToken(idToken: string | null | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { picture?: unknown };
    return typeof claims.picture === "string" ? claims.picture : null;
  } catch {
    return null;
  }
}

/** The Google picture saved for this user (from their latest Google sign-in). */
export async function savedGooglePicture(userId: string): Promise<string | null> {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: "google", id_token: { not: null } },
    select: { id_token: true },
  });
  return accounts.map((a) => pictureFromIdToken(a.id_token)).find(Boolean) ?? null;
}

/**
 * Give everyone who has signed in with Google before, and has no picture or
 * one that no longer loads, their Google picture now rather than at their
 * next sign-in. The picture comes from the ID token saved at their latest
 * Google sign-in (auth.ts). Run by Admin > Users and by the daily cron;
 * people whose picture loads are left alone, so re-runs are cheap.
 */
export async function backfillGoogleAvatars(
  limit = 500,
): Promise<{ checked: number; updated: number; stale: number; noPicture: number }> {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      accounts: { some: { provider: "google", id_token: { not: null } } },
    },
    select: {
      id: true,
      avatarUrl: true,
      accounts: { where: { provider: "google" }, select: { id_token: true } },
    },
    take: limit,
  });
  let checked = 0;
  let updated = 0;
  let stale = 0;
  let noPicture = 0;
  // A few at a time: each is a check, a download from Google and an upload to Blob.
  for (let i = 0; i < users.length; i += 5) {
    const results = await Promise.all(
      users.slice(i, i + 5).map(async (u): Promise<GoogleAvatarOutcome | "no-picture" | null> => {
        if (u.avatarUrl && (await pictureLoads(u.avatarUrl))) return null;
        const picture = u.accounts.map((a) => pictureFromIdToken(a.id_token)).find(Boolean);
        if (!picture) return "no-picture";
        return setGoogleAvatar(u, picture, { force: true });
      }),
    );
    for (const r of results) {
      if (r === null) continue;
      if (r === "no-picture") {
        noPicture++;
        continue;
      }
      checked++;
      if (r === "updated") updated++;
      if (r === "stale") stale++;
    }
  }
  return { checked, updated, stale, noPicture };
}
