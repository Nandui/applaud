import { ValueIcon } from "@/components/value-icon";
import { cn } from "@/lib/utils";

type Value = { name: string; icon: string | null; color: string | null };

const SIZES = {
  sm: { seal: "size-11", icon: "size-5", ribbon: "text-[0.55rem] px-1.5 -mt-2" },
  md: { seal: "size-16", icon: "size-7", ribbon: "text-[0.62rem] px-2 -mt-2.5" },
  lg: { seal: "size-24", icon: "size-11", ribbon: "text-xs px-2.5 -mt-3" },
} as const;

/**
 * A value as a medal: a glossy seal in the value's colour with a dashed
 * stitched edge, and the value's name on a ribbon across the bottom. Used on
 * shout-outs (as a sticker on the picture) and wherever a value is the point.
 */
export function ValueSeal({
  value,
  size = "md",
  className,
}: {
  value: Value;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const colour = value.color ?? "#6a4dff";
  return (
    <span className={cn("inline-flex flex-col items-center", className)} title={value.name}>
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full text-white shadow-[0_6px_16px_-4px_rgb(0_0_0/0.45)] ring-[3px] ring-white",
          s.seal,
        )}
        style={{
          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${colour} 55%, white), ${colour} 62%, color-mix(in srgb, ${colour} 75%, black))`,
        }}
      >
        <span aria-hidden className="absolute inset-[4px] rounded-full border-[1.5px] border-dashed border-white/60" />
        <ValueIcon icon={value.icon} className={cn("relative drop-shadow", s.icon)} strokeWidth={2.2} />
      </span>
      <span
        className={cn(
          "relative max-w-[9rem] truncate rounded-md py-0.5 font-extrabold tracking-wider text-white uppercase shadow-md ring-2 ring-white",
          s.ribbon,
        )}
        style={{ backgroundColor: `color-mix(in srgb, ${colour} 85%, black)` }}
      >
        {value.name}
      </span>
    </span>
  );
}
