import { auth } from "@/auth";
import { presignedImageUpload } from "@/lib/blob-upload";

export const dynamic = "force-dynamic";

/**
 * Admin-only client-upload endpoint for user avatars. See lib/blob-upload.ts.
 */
export async function POST(request: Request) {
  return presignedImageUpload(request, async () => {
    const session = await auth();
    if (session?.user?.role !== "admin") throw new Error("Admins only.");
  });
}
