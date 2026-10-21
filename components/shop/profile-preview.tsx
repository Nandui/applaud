import { FramedAvatar } from "@/components/user-avatar";
import { bannerStyle, themeColour } from "@/lib/cosmetics";
import { isLight } from "@/lib/profile-custom";
import { cn } from "@/lib/utils";

/**
 * A small version of someone's profile header (banner, framed avatar, name and
 * an accent-coloured button) so shop items can be tried on before buying.
 */
export function ProfilePreview({
  name,
  avatarUrl,
  frame,
  banner,
  theme,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  frame: string | null;
  banner: string | null;
  theme: string | null;
  className?: string;
}) {
  const accent = themeColour(theme);
  return (
    <div className={cn("bg-background border-border overflow-hidden rounded-2xl border", className)}>
      <div className="h-20" style={{ background: bannerStyle(banner) }} />
      <div className="flex items-end gap-3 px-4 pb-4">
        <div className="-mt-9">
          <FramedAvatar name={name} avatarUrl={avatarUrl} frame={frame} className="size-16 text-lg" />
        </div>
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
