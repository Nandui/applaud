import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GIF_SEARCH_LIMIT } from "@/lib/config";
import type { GifResult } from "@/lib/recognition/gif";

export const dynamic = "force-dynamic";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

type GiphyRendition = { url?: string; width?: string; height?: string };
type GiphyGif = {
  id?: string;
  title?: string;
  images?: Record<string, GiphyRendition>;
};

/**
 * Map a GIPHY result to our shape. `bundle=fixed_height` returns the
 * 200px-tall animated rendition (stored + shown in the feed) plus a small
 * animated one for the picker grid. Drop anything missing a usable URL.
 */
function toGifResult(g: GiphyGif): GifResult | null {
  const full = g.images?.fixed_height;
  const preview = g.images?.fixed_height_small ?? full;
  if (!g.id || !full?.url || !preview?.url) return null;
  return {
    id: g.id,
    url: full.url,
    previewUrl: preview.url,
    width: Number(full.width) || 0,
    height: Number(full.height) || 0,
    title: g.title?.trim() || "GIF",
  };
}

/**
 * GIF-library search, proxied so the GIPHY API key never reaches the browser.
 * Auth-gated (same bar as posting). Empty query returns trending. When no
 * GIPHY_API_KEY is set the route degrades gracefully with `configured: false`
 * so the picker can explain itself instead of erroring.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ configured: false, gifs: [] });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(GIF_SEARCH_LIMIT),
    rating: "pg-13",
    bundle: "fixed_height",
  });
  if (q) params.set("q", q);
  const endpoint = `${GIPHY_BASE}/${q ? "search" : "trending"}?${params}`;

  try {
    // Cache identical queries briefly to stay comfortably under rate limits.
    const res = await fetch(endpoint, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json(
        { configured: true, gifs: [], error: "GIF search failed." },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { data?: GiphyGif[] };
    const gifs = (data.data ?? [])
      .map(toGifResult)
      .filter((g): g is GifResult => g !== null);
    return NextResponse.json({ configured: true, gifs });
  } catch {
    return NextResponse.json(
      { configured: true, gifs: [], error: "GIF search failed." },
      { status: 502 },
    );
  }
}
