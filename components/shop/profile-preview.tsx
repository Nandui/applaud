import { FramedAvatar } from "@/components/user-avatar";
import type { Look, Rarity } from "@/lib/cosmetics";
import { isLight } from "@/lib/contrast";
import { cn } from "@/lib/utils";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PopOnChange } from "@/components/fx/pop-on-change";

/**
 * A small version of someone's profile header (banner, framed avatar, name and
 * a theme colour swatch) so shop items can be tried on before buying.
 * It moves like the real profile; pass `popKey` (what's worn) to bounce the
 * avatar when that changes, i.e. right after equipping something.
 *
 * The banner stays 3:1 like the profile, so it gets tall on wide screens. The
 * avatar, name and swatch grow with the card's width (container units, so the
 * same in the Store, the try-on sheet and Admin > Store): the avatar is about
 * 42% of the banner's height and overlaps it by half, the name about a
 * quarter of the avatar. Phone sizes have a floor so they never shrink.
 */
export function ProfilePreview({
  name,
  avatarUrl,
  look,
  frameRarity,
  popKey,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  look: Look;
  /** The worn frame's rarity, for its shimmer. */
  frameRarity?: Rarity | null;
  popKey?: string;
  className?: string;
}) {
  const accent = look.theme;
  return (
    <div className={cn("bg-background border-border @container overflow-hidden rounded-2xl border", className)}>
      <ProfileBanner background={look.banner} className="aspect-[3/1]" />
      <div className="flex items-center gap-[clamp(0.625rem,2.5cqw,1.25rem)] px-[clamp(1rem,3.5cqw,1.75rem)] py-[clamp(0.75rem,2.5cqw,1.25rem)]">
        {/* The negative margin pulls the avatar half over the banner and also
            cancels the row's top padding, so the name and swatch centre on
            the strip under the banner. */}
        <PopOnChange
          value={popKey ?? ""}
          className="relative -mt-[calc(clamp(2rem,7cqw,3.5rem)+clamp(0.75rem,2.5cqw,1.25rem))]"
        >
          <FramedAvatar
            name={name}
            avatarUrl={avatarUrl}
            frame={look.frame}
            className="size-[clamp(4rem,14cqw,7rem)] **:data-[slot=avatar-fallback]:text-[clamp(1.125rem,3.6cqw,1.875rem)]"
            shine={frameRarity}
          />
        </PopOnChange>
        <p className="min-w-0 flex-1 truncate text-[clamp(1rem,3.6cqw,1.875rem)] leading-tight font-bold">{name}</p>
        {/* Not a button: a swatch of the theme's accent colour (the colour of
            the Recognize button on the real profile). */}
        <span
          className="shrink-0 rounded-full px-[clamp(0.625rem,2cqw,1.125rem)] py-[clamp(0.25rem,1cqw,0.5rem)] text-[clamp(0.6875rem,1.6cqw,0.9375rem)] font-semibold"
          style={{ backgroundColor: accent, color: isLight(accent) ? "#0a0a0a" : "#ffffff" }}
        >
          Theme colour
        </span>
      </div>
    </div>
  );
}
