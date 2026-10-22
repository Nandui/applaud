import { auth } from "@/auth";
import { isProjectBlobUrl } from "@/lib/blob";

export const dynamic = "force-dynamic";

/**
 * Admin-only: hands back a Store picture from our Blob store from this origin,
 * so Admin > Store can read its pixels on a canvas to auto-fit a frame
 * (lib/frame-measure.ts) without depending on the Blob host's CORS headers.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return new Response("Admins only.", { status: 403 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isProjectBlobUrl(url)) return new Response("Unrecognised picture URL.", { status: 400 });
  const upstream = await fetch(url, { cache: "no-store" });
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) return new Response("Picture not found.", { status: 404 });
  return new Response(upstream.body, {
    headers: { "content-type": type, "cache-control": "private, max-age=300" },
  });
}
