import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Client-upload token endpoint for recognition photos/GIFs.
 *
 * The browser uploads files DIRECTLY to Vercel Blob (see `upload()` in the
 * recognize form) rather than POSTing bytes through a server action — this
 * sidesteps the 4.5 MB serverless body limit so larger GIFs go through. This
 * route only mints a short-lived, content-type/size-restricted upload token
 * for authenticated users; it never receives the file bytes itself.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Blob upload refused: BLOB_READ_WRITE_TOKEN is not set. Connect a Blob store and redeploy.");
    return NextResponse.json({ error: "Picture storage is not set up." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user) throw new Error("Not authenticated.");
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      // Required by the SDK. We don't persist here: the client submits the
      // returned blob URL with the recognition form, and Vercel can't reach
      // this callback in local dev anyway, so it must not be relied upon.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (error) {
    // The client SDK hides this body, so log it for the Vercel Logs tab.
    console.error("Blob upload token request failed:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
