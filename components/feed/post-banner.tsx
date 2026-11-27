import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A post without a photo: the words, large, on the author's own banner from
 * the profile shop. Used in the feed and as the composer's preview. Polls and
 * questions use it too, with a small label ("Poll", "Question") on top.
 *
 * Banners can be any picture or GIF, including busy or very light ones with
 * their own lettering, so the words sit on a frosted, dimmed panel: the panel
 * blurs and darkens whatever is behind it, which keeps white text readable on
 * any banner (well above 4.5:1 even on pure white), while the rest of the
 * picture stays visible around it. Plain colour banners are made for white
 * text, so they keep the words straight on the colour.
 *
 * No overflow-hidden here: when the words need more room than the 2:1 or 5:4
 * shape gives (long questions on a phone), the box grows instead of cutting
 * them off. The feed card around it does the rounding and clipping.
 */
export function PostBanner({
  banner,
  message,
  label,
  className,
}: {
  banner: string;
  message: string;
  label?: ReactNode;
  className?: string;
}) {
  const isPicture = isPictureBanner(banner);
  return (
    <div
      className={cn(
        "relative flex aspect-[5/4] flex-col items-center justify-center px-5 text-center text-white sm:px-8",
        className,
      )}
      style={{ background: banner }}
    >
      <div aria-hidden className="absolute inset-0 rounded-[inherit] bg-black/15" />
      <div
        className={cn(
          "relative flex max-w-md flex-col items-center gap-2.5 rounded-2xl px-5 py-4",
          isPicture ? "bg-black/50 shadow-lg ring-1 ring-white/10 backdrop-blur-md" : "",
        )}
      >
        {label && (
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[0.72rem] font-bold tracking-wider uppercase">
            {label}
          </span>
        )}
        <p
          className={cn(
            "line-clamp-6 leading-snug font-bold tracking-tight break-words whitespace-pre-line [text-shadow:0_1px_3px_rgb(0_0_0/0.4)]",
            message.length > 90 ? "text-lg" : "text-2xl",
          )}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

/** Shop banners are either a plain colour/gradient or an uploaded picture/GIF. */
export function isPictureBanner(banner: string) {
  return banner.includes("url(");
}

/**
 * Frosted glass behind words that sit on a banner picture: it softens and
 * darkens only the patch under the words, so they read on any picture while
 * the rest of the banner keeps its colour and motion. On plain colour banners
 * (made for white text) it draws nothing extra.
 */
export function BannerTextGlass({
  picture,
  className,
  children,
}: {
  picture: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl",
        picture && "bg-black/45 px-4 py-2.5 shadow-lg ring-1 ring-white/10 backdrop-blur-[6px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
