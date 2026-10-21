import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Default-avatar palettes (Discord gives everyone a coloured default). Picked
 * from a stable hash of the name so a person always gets the same one.
 */
const FALLBACKS = [
  "from-[#7c5cff] to-[#b39dff]",
  "from-[#ff4f9a] to-[#ff9fc6]",
  "from-[#22c55e] to-[#c6f432]",
  "from-[#0ea5e9] to-[#67e8f9]",
  "from-[#f97316] to-[#fcd34d]",
  "from-[#a855f7] to-[#f0abfc]",
  "from-[#14b8a6] to-[#5eead4]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function UserAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} className="object-cover" /> : null}
      <AvatarFallback
        className={cn(
          "bg-gradient-to-br text-xs font-bold text-white",
          FALLBACKS[hash(name) % FALLBACKS.length],
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * An avatar wearing its earned decoration ring (see globals.css `.deco-*`),
 * with an optional status bubble. Used on profiles and the profile editor.
 */
export function DecoratedAvatar({
  name,
  avatarUrl,
  decoration,
  className,
  ringClassName,
  large = false,
}: {
  name: string;
  avatarUrl?: string | null;
  decoration?: string | null;
  className?: string;
  /** The gap between avatar and decoration (matches the page background). */
  ringClassName?: string;
  /** Profile-sized: thicker decoration ring. */
  large?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0 rounded-full">
      <span className={cn("bg-background rounded-full", large ? "p-[7px]" : "p-[4px]", ringClassName)}>
        <UserAvatar name={name} avatarUrl={avatarUrl} className={className} />
      </span>
      {decoration ? <span aria-hidden className={cn("deco", `deco-${decoration}`, large && "deco-lg")} /> : null}
    </span>
  );
}
