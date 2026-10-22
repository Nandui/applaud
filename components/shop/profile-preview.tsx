import { FramedAvatar } from "@/components/user-avatar";
import type { Look, Rarity } from "@/lib/cosmetics";
import { isLight } from "@/lib/contrast";
import { cn } from "@/lib/utils";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PopOnChange } from "@/components/fx/pop-on-change";

/**
 * A small version of someone's profile header (banner, framed avatar, name and
 * an accent-coloured button) so shop items can be tried on before buying.
 * It moves like the real profile; pass `popKey` (what's worn) to bounce the
 * avatar when that changes, i.e. right after equipping something.
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
    <div className={cn("bg-background border-border overflow-hidden rounded-2xl border", className)}>
      <ProfileBanner background={look.banner} className="aspect-[3/1]" />
      <div className="flex items-end gap-3 px-4 pb-4">
        <PopOnChange value={popKey ?? ""} className="relative -mt-9">
          <FramedAvatar
            name={name}
            avatarUrl={avatarUrl}
            frame={look.frame}
            className="size-16 text-lg"
            shine={frameRarity}
          />
        </PopOnChange>
        <div className="min-w-0 flex-1 pb-1">
          <p className="truncate font-bold">{name}</p>
        </div>
        <span
          className="mb-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: accent, color: isLight(accent) ? "#0a0a0a" : "#ffffff" }}
        >
          Shout-out
        </span>
      </div>
    </div>
  );
}
