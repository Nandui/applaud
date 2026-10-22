import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RARITY, isFrameImage, type FrameArt, type Rarity } from "@/lib/cosmetics";
import { splitFrameImage } from "@/lib/frame-fit";
import { cssImageUrl, optimizedImage } from "@/lib/image-url";

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
      {/* One resized copy per person (96px, the profile size) serves every avatar size. */}
      {avatarUrl ? (
        <AvatarImage src={optimizedImage(avatarUrl, 96)} alt={name} className="object-cover" />
      ) : null}
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
 * frames are placed by their fit (lib/frame-fit.ts): drawn at its size and
 * shifted so its see-through hole sits on the avatar, like Discord avatar
 * decorations. Without a frame it's a plain avatar with the same gap,
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
        <FrameImage art={frame} shineClassName={shiny ? shineClass : undefined} />
      ) : frame ? (
        <span aria-hidden className={cn("frame-ring", frame, large && "frame-ring-lg")}>
          {shiny ? <span className={cn(shineClass, "inset-0")} /> : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * An uploaded frame picture, sized and shifted by its fit so its hole sits on
 * the avatar, with its shimmer (masked to the picture) when it has one.
 */
function FrameImage({ art, shineClassName }: { art: FrameArt; shineClassName?: string }) {
  const { src: original, fit } = splitFrameImage(art);
  // Frames are drawn a little wider than the avatar; the largest is the 96px
  // profile avatar, so a 160px copy covers every place they appear.
  const src = optimizedImage(original, 160);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 block"
      style={{
        width: `${fit.size * 100}%`,
        transform: `translate(${-fit.x * 100}%, ${-fit.y * 100}%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded Blob art, any size */}
      <img src={src} alt="" draggable={false} className="block h-auto w-full max-w-none select-none" />
      {shineClassName ? (
        <span
          className={cn(shineClassName, "frame-shine-image inset-0")}
          style={{ "--frame-mask": `url("${cssImageUrl(original, 160)}")` } as React.CSSProperties}
        />
      ) : null}
    </span>
  );
}
