import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RARITY, isFrameImage, type FrameArt, type Rarity } from "@/lib/cosmetics";

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
 * An avatar wearing its shop frame: a built-in CSS ring (globals.css
 * `.frame-*`) or an uploaded overlay picture (see lib/cosmetics.ts). Picture
 * frames are drawn 20% bigger than the avatar and centred on it, like Discord
 * avatar decorations. Without a frame it's a plain avatar with the same gap,
 * so layouts don't jump when someone equips one.
 *
 * Pass `shine` (the frame's rarity) where the avatar is the focus, such as a
 * profile header: epic and legendary frames then catch the light now and
 * then, and legendary ones glow softly too. Feeds leave it off to stay calm.
 */
export function FramedAvatar({
  name,
  avatarUrl,
  frame,
  className,
  gapClassName,
  large = false,
  shine,
}: {
  name: string;
  avatarUrl?: string | null;
  /** Frame art: a built-in class such as "frame-neon", or an uploaded image URL. */
  frame?: FrameArt | null;
  className?: string;
  /** The gap between avatar and frame (matches what's behind it). */
  gapClassName?: string;
  /** Profile-sized: thicker frame. */
  large?: boolean;
  /** The frame's rarity, to add its shimmer (see above). */
  shine?: Rarity | null;
}) {
  const shiny = frame && (shine === "epic" || shine === "legendary");
  const shineClass = cn("frame-shine", shine === "legendary" && "frame-shine-legendary");
  return (
    <span className="relative inline-flex shrink-0 rounded-full">
      {shiny && shine === "legendary" ? (
        <span
          aria-hidden
          className="frame-aura"
          style={{ "--aura": `${RARITY.legendary.color}66` } as React.CSSProperties}
        />
      ) : null}
      <span className={cn("bg-background relative rounded-full", large ? "p-[6px]" : "p-[3px]", gapClassName)}>
        <UserAvatar name={name} avatarUrl={avatarUrl} className={className} />
      </span>
      {frame && isFrameImage(frame) ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded Blob art, any size
        <img
          src={frame}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-[-10%] size-[120%] max-w-none object-contain select-none"
        />
      ) : frame ? (
        <span aria-hidden className={cn("frame-ring", frame, large && "frame-ring-lg")}>
          {shiny ? <span className={cn(shineClass, "inset-0")} /> : null}
        </span>
      ) : null}
      {shiny && isFrameImage(frame) ? (
        <span
          aria-hidden
          className={cn(shineClass, "frame-shine-image inset-[-10%] size-[120%]")}
          style={{ "--frame-mask": `url("${encodeURI(frame)}")` } as React.CSSProperties}
        />
      ) : null}
    </span>
  );
}
