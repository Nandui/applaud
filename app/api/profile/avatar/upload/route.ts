import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Client-upload token endpoint for a person's OWN profile picture (Edit
 * profile). Mirrors the admin avatar route but is open to any signed-in user;
 * the resulting URL is only ever written to their own row by setMyAvatar.
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
        if (!session?.user?.id) throw new Error("Sign in first.");
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
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
