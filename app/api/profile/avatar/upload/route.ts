import { auth } from "@/auth";
import { presignedImageUpload } from "@/lib/blob-upload";

export const dynamic = "force-dynamic";

/**
 * Client-upload endpoint for a person's OWN profile picture (Edit profile).
 * Open to any signed-in user; the resulting URL is only ever written to their
 * own row by setMyAvatar. See lib/blob-upload.ts.
 */
export async function POST(request: Request) {
  return presignedImageUpload(request, async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Sign in first.");
  });
}
