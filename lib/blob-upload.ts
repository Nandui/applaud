import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";

/**
 * Shared body of every client-upload route. The browser uploads the picture
 * DIRECTLY to Vercel Blob with `uploadPresigned()` (sidestepping the 4.5 MB
 * serverless body limit); this only hands out a short-lived presigned PUT URL,
 * scoped to one pathname, image types and MAX_IMAGE_BYTES, after `authorize`
 * passes. It never receives the bytes.
 *
 * Presigned uploads work with both kinds of Blob credentials: OIDC
 * (`BLOB_STORE_ID`, what newly connected stores inject) and the older
 * `BLOB_READ_WRITE_TOKEN`. The plain `handleUpload` only accepts the latter.
 *
 * No upload-completed callback: clients submit the returned URL with their
 * form, and Vercel can't reach a callback behind Deployment Protection or in
 * local dev anyway.
 */
export async function presignedImageUpload(
  request: Request,
  authorize: () => Promise<void>,
): Promise<NextResponse> {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Blob upload refused: no Blob store is connected (BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN). Connect one and redeploy.");
    return NextResponse.json({ error: "Picture storage is not set up." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadPresignedBody;
  const constraints = {
    allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
    maximumSizeInBytes: MAX_IMAGE_BYTES,
  };

  try {
    const json = await handleUploadPresigned({
      body,
      request,
      // Only used to verify upload-completed callbacks, which we don't take,
      // but the SDK insists on one. Read-write-token stores don't inject it.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || "unused",
      getSignedToken: async (pathname) => {
        await authorize();
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({ pathname, operations: ["put"], validUntil, ...constraints });
        return { token, urlOptions: { ...constraints, validUntil, addRandomSuffix: true, allowOverwrite: false } };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    // The client SDK hides this body, so log it for the Vercel Logs tab.
    console.error("Blob upload URL request failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
