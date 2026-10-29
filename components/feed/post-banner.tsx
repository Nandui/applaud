import { cn } from "@/lib/utils";

/**
 * A post without a photo: the words, large, on the author's own banner from
 * the profile shop. Used in the feed and as the composer's preview.
 */
export function PostBanner({ banner, message, className }: { banner: string; message: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-[5/4] items-center justify-center overflow-hidden px-8 text-center text-white",
        className,
      )}
      style={{ background: banner }}
    >
      <div aria-hidden className="absolute inset-0 bg-black/15" />
      <p
        className={cn(
          "relative line-clamp-6 max-w-sm leading-snug font-bold tracking-tight break-words whitespace-pre-line [text-shadow:0_2px_12px_rgb(0_0_0/0.35)]",
          message.length > 90 ? "text-lg" : "text-2xl",
        )}
      >
        {message}
      </p>
    </div>
  );
}
