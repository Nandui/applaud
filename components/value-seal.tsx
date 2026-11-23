import { ValueIcon } from "@/components/value-icon";
import { cn } from "@/lib/utils";
import { optimizedImage } from "@/lib/image-url";

export type SealValue = {
  name: string;
  icon: string | null;
  color: string | null;
  /** Badge artwork uploaded in admin; fills the hexagon in place of the icon. */
  imageUrl?: string | null;
};

/** Badge edge length in px (the hexagon is drawn inside a square this size). */
const SIZES = {
  xs: { px: 32, ribbon: "" },
  sm: { px: 48, ribbon: "text-[0.55rem] px-1.5 mt-1" },
  md: { px: 64, ribbon: "text-[0.62rem] px-2 mt-1.5" },
  lg: { px: 96, ribbon: "text-xs px-2.5 mt-2" },
} as const;

export type BadgeSize = keyof typeof SIZES;

export const DEFAULT_VALUE_COLOR = "#6a4dff";
export const DEFAULT_AWARD_COLOR = "#f5b400";

/**
 * The holo collectible hexagon every badge in the app uses: a metal rim, a
 * face in the badge's colour (or an uploaded picture) with a white icon or a
 * short label, and a holographic foil that slowly shimmers like the glint on
 * epic and legendary frames. Styles live in globals.css (.value-holo).
 *
 * Rims: silver for values, gold for awards, and gold/silver/bronze for the
 * top three on the leaderboard.
 */
export function HoloBadge({
  color,
  icon,
  imageUrl,
  label,
  size = "md",
  rim = "silver",
  className,
}: {
  color: string;
  icon?: string | null;
  imageUrl?: string | null;
  /** Short text (a rank number) shown instead of an icon. */
  label?: React.ReactNode;
  /** A preset, or an exact edge length in px. */
  size?: BadgeSize | number;
  rim?: "silver" | "gold" | "bronze";
  className?: string;
}) {
  const px = typeof size === "number" ? size : SIZES[size].px;
  // The shimmer and sparkle are for badges big enough to see them.
  const tiny = px < 40;
  return (
    <span
      className={cn("value-holo", className)}
      data-rim={rim}
      data-tiny={tiny || undefined}
      style={{ "--c": color, "--s": `${px}px` } as React.CSSProperties}
    >
      <span aria-hidden className="value-holo-rim" />
      <span aria-hidden className="value-holo-face">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(imageUrl, 192)}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <span className="value-holo-foil" />
        <span className="value-holo-shine" />
      </span>
      {label != null ? (
        <span data-numeric className="value-holo-label">
          {label}
        </span>
      ) : (
        !imageUrl && <ValueIcon icon={icon} className="value-holo-icon" strokeWidth={2.3} />
      )}
      {px >= 60 && (
        <svg aria-hidden viewBox="0 0 24 24" className="value-holo-spark" fill="currentColor">
          <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
        </svg>
      )}
    </span>
  );
}

/** An award program's badge: the hexagon with a gold rim (trophy by default). */
export function AwardBadge({
  award,
  size = "md",
  className,
}: {
  award: { name: string; icon?: string | null; color?: string | null };
  size?: BadgeSize | number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0", className)} title={award.name}>
      <HoloBadge
        color={award.color || DEFAULT_AWARD_COLOR}
        icon={award.icon || "Trophy"}
        size={size}
        rim="gold"
      />
    </span>
  );
}

/**
 * A value's badge: the silver-rimmed hexagon in the value's colour, and
 * optionally the value's name on a small ribbon underneath.
 */
export function ValueSeal({
  value,
  size = "md",
  ribbon = size !== "xs",
  className,
}: {
  value: SealValue;
  size?: BadgeSize;
  ribbon?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const colour = value.color || DEFAULT_VALUE_COLOR;
  return (
    <span className={cn("inline-flex shrink-0 flex-col items-center", className)} title={value.name}>
      <HoloBadge color={colour} icon={value.icon} imageUrl={value.imageUrl} size={size} />
      {ribbon && (
        <span
          className={cn(
            "relative max-w-[9rem] truncate rounded-full py-0.5 font-extrabold tracking-wider text-white uppercase shadow-md",
            s.ribbon,
          )}
          style={{ backgroundColor: `color-mix(in srgb, ${colour} 80%, black)` }}
        >
          {value.name}
        </span>
      )}
    </span>
  );
}
