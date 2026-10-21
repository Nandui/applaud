import { ValueIcon } from "@/components/value-icon";
import { cn } from "@/lib/utils";

export type SealValue = {
  name: string;
  icon: string | null;
  color: string | null;
  /** Badge artwork uploaded in admin; replaces the icon when set. */
  imageUrl?: string | null;
};

const SIZES = {
  xs: { seal: "size-8 ring-2", icon: "size-4", ribbon: "" },
  sm: { seal: "size-12 ring-[3px]", icon: "size-6", ribbon: "text-[0.55rem] px-1.5 -mt-2" },
  md: { seal: "size-16 ring-[3px]", icon: "size-7", ribbon: "text-[0.62rem] px-2 -mt-2.5" },
  lg: { seal: "size-24 ring-4", icon: "size-11", ribbon: "text-xs px-2.5 -mt-3" },
} as const;

/**
 * A value as a medal: the admin's badge picture (or a glossy seal in the
 * value's colour with its icon) with a stitched edge, and optionally the
 * value's name on a ribbon across the bottom.
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
  const colour = value.color ?? "#6a4dff";
  return (
    <span className={cn("inline-flex shrink-0 flex-col items-center", className)} title={value.name}>
      <span
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full text-white shadow-[0_6px_16px_-4px_rgb(0_0_0/0.45)] ring-white",
          s.seal,
        )}
        style={{
          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${colour} 55%, white), ${colour} 62%, color-mix(in srgb, ${colour} 75%, black))`,
        }}
      >
        {value.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            {size !== "xs" && (
              <span aria-hidden className="absolute inset-[4px] rounded-full border-[1.5px] border-dashed border-white/60" />
            )}
            <ValueIcon icon={value.icon} className={cn("relative drop-shadow", s.icon)} strokeWidth={2.2} />
          </>
        )}
      </span>
      {ribbon && (
        <span
          className={cn(
            "relative max-w-[9rem] truncate rounded-md py-0.5 font-extrabold tracking-wider text-white uppercase shadow-md ring-2 ring-white",
            s.ribbon,
          )}
          style={{ backgroundColor: `color-mix(in srgb, ${colour} 85%, black)` }}
        >
          {value.name}
        </span>
      )}
    </span>
  );
}
