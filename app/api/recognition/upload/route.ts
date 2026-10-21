import { auth } from "@/auth";
import { presignedImageUpload } from "@/lib/blob-upload";

export const dynamic = "force-dynamic";

/**
 * Client-upload endpoint for recognition photos/GIFs, open to any signed-in
 * user. See lib/blob-upload.ts.
 */
export async function POST(request: Request) {
  return presignedImageUpload(request, async () => {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated.");
  });
}
