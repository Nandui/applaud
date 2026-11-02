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
 * The banner stays 3:1 like the profile, so on wide screens it gets tall; the
 * avatar, name and button grow with the card's width (container units) so
 * they keep the same proportion to the banner instead of looking tiny under
 * it. At phone width they're the same size as before.
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
      <div className="flex items-end gap-[clamp(0.75rem,2.5cqw,1.25rem)] px-[clamp(1rem,3cqw,1.5rem)] pb-[clamp(1rem,3cqw,1.5rem)]">
        {/* Avatar about 40% of the banner's height, overlapping it by half. */}
        <PopOnChange value={popKey ?? ""} className="relative -mt-[clamp(2.25rem,7cqw,3.5rem)]">
          <FramedAvatar
            name={name}
            avatarUrl={avatarUrl}
            frame={look.frame}
            className="size-[clamp(4rem,13cqw,6.5rem)] **:data-[slot=avatar-fallback]:text-[clamp(0.875rem,3.2cqw,1.75rem)]"
            shine={frameRarity}
          />
        </PopOnChange>
        <div className="min-w-0 flex-1 pb-1">
          <p className="truncate text-[clamp(1rem,3.4cqw,1.75rem)] leading-tight font-bold">{name}</p>
        </div>
        {/* Not a button: a swatch of the theme's accent colour, the colour of
            the "Send … a shout-out" button on the real profile. */}
        <span
          className="mb-1 shrink-0 rounded-lg px-[clamp(0.75rem,2cqw,1.125rem)] py-[clamp(0.375rem,1.1cqw,0.625rem)] text-[clamp(0.75rem,1.8cqw,0.9375rem)] font-semibold"
          style={{ backgroundColor: accent, color: isLight(accent) ? "#0a0a0a" : "#ffffff" }}
        >
          Theme colour
        </span>
      </div>
    </div>
  );
}
