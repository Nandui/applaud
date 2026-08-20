import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Admin-only client-upload token endpoint for reward images. The browser uploads
 * the picture directly to Vercel Blob (see the reward form) rather than POSTing
 * bytes through a server action; this route only mints a short-lived,
 * content-type/size-restricted token for admins. It never receives the bytes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (session?.user?.role !== "admin") throw new Error("Admins only.");
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      // Required by the SDK. The client submits the returned blob URL with the
      // user form; Vercel can't reach this callback in local dev anyway.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
