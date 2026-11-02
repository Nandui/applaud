"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Film, Sticker } from "lucide-react";
import type { GifResult } from "@/lib/recognition/gif";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SearchResponse = {
  configured?: boolean;
  gifs?: GifResult[];
  error?: string;
};

/**
 * "Add a GIF" tile + dialog. Searches GIPHY (via our proxy route so the API key
 * stays server-side) and hands the picked GIF up to the composer, which stores
 * its URL in the same `imageUrls` set as uploaded photos. Empty query shows
 * trending. Disabled once the attachment cap is reached. With
 * `kind="stickers"` it searches GIPHY stickers instead (comments use both).
 */
export function GifPicker({
  onSelect,
  disabled,
  triggerClassName,
  kind = "gifs",
}: {
  onSelect: (gif: GifResult) => void;
  disabled?: boolean;
  kind?: "gifs" | "stickers";
  /** Replaces the default tile styling (the composer uses a toolbar icon). */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so a slow response can't overwrite a newer query's results.
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const debounce = query ? 350 : 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const type = kind === "stickers" ? "&type=stickers" : "";
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}${type}`);
        const data = (await res.json()) as SearchResponse;
        if (id !== reqId.current) return;
        if (data.configured === false) {
          setConfigured(false);
          setGifs([]);
        } else {
          setConfigured(true);
          setGifs(data.gifs ?? []);
          if (data.error) setError("Couldn't load GIFs. Try again.");
        }
      } catch {
        if (id === reqId.current) setError("Couldn't load GIFs. Try again.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, debounce);
    return () => clearTimeout(timer);
  }, [open, query, kind]);

  function pick(gif: GifResult) {
    onSelect(gif);
    setOpen(false);
    setQuery("");
  }

  const stickers = kind === "stickers";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={stickers ? "Add a sticker" : "Add a GIF"}
          className={
            triggerClassName ??
            "bg-secondary text-foreground flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl transition-transform active:scale-95 disabled:opacity-50"
          }
        >
          {triggerClassName && stickers ? (
            <Sticker className="size-5" />
          ) : triggerClassName ? (
            <span className="rounded-md border-2 border-current px-1 text-[0.6rem] leading-tight font-black">
              GIF
            </span>
          ) : (
            <>
              <Film className="size-5" />
              <span className="text-[0.7rem] font-semibold">GIF</span>
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{stickers ? "Add a sticker" : "Add a GIF"}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIPHY…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-80 min-h-40 overflow-y-auto">
          {!configured ? (
            <p className="text-muted py-10 text-center text-sm">
              GIF search isn’t set up yet. Add a{" "}
              <code className="font-mono">GIPHY_API_KEY</code> to enable it.
            </p>
          ) : loading && gifs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-muted size-6 animate-spin" />
            </div>
          ) : error && gifs.length === 0 ? (
            <p className="text-muted py-10 text-center text-sm">{error}</p>
          ) : gifs.length === 0 ? (
            <p className="text-muted py-10 text-center text-sm">
              No {stickers ? "stickers" : "GIFs"} found. Try another search.
            </p>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => pick(gif)}
                  className="hover:ring-primary mb-2 block w-full break-inside-avoid overflow-hidden rounded-md transition-shadow hover:ring-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-muted text-center text-[0.65rem]">Powered by GIPHY</p>
      </DialogContent>
    </Dialog>
  );
}
