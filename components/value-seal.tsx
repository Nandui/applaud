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

export const DEFAULT_VALUE_COLOR = "#6a4dff";

/**
 * A value as a holo collectible: a hexagon with a silver rim, a face in the
 * value's colour (or the admin's uploaded picture) and a holographic foil
 * that slowly shimmers, matching the glint on epic and legendary frames.
 * Styles live in globals.css (.value-holo). Optionally the value's name sits
 * on a small ribbon underneath.
 */
export function ValueSeal({
  value,
  size = "md",
  ribbon = size !== "xs",
  className,
}: {
  value: SealValue;
  size?: keyof typeof SIZES;
  ribbon?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const colour = value.color || DEFAULT_VALUE_COLOR;
  return (
    <span className={cn("inline-flex shrink-0 flex-col items-center", className)} title={value.name}>
      <span
        className="value-holo"
        data-size={size}
        style={{ "--c": colour, "--s": `${s.px}px` } as React.CSSProperties}
      >
        <span aria-hidden className="value-holo-rim" />
        <span aria-hidden className="value-holo-face">
          {value.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizedImage(value.imageUrl, 192)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <span className="value-holo-foil" />
          <span className="value-holo-shine" />
        </span>
        {!value.imageUrl && <ValueIcon icon={value.icon} className="value-holo-icon" strokeWidth={2.3} />}
        {size !== "xs" && size !== "sm" && (
          <svg aria-hidden viewBox="0 0 24 24" className="value-holo-spark" fill="currentColor">
            <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
          </svg>
        )}
      </span>
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
