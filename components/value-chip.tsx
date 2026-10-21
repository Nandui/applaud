import { ValueIcon } from "@/components/value-icon";
import { cn } from "@/lib/utils";

export type ValueChipData = {
  name: string;
  icon?: string | null;
  color?: string | null;
};

/** Convert a #rrggbb hex to an rgba() tint for subtle chip backgrounds. */
export function tint(hex?: string | null, alpha = 0.12): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ValueChip({
  value,
  className,
}: {
  value: ValueChipData;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-foreground inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        className,
      )}
      style={{ backgroundColor: tint(value.color, 0.18) ?? "var(--surface-2)" }}
    >
      <ValueIcon
        icon={value.icon}
        className="size-3.5 shrink-0"
        style={value.color ? { color: value.color } : undefined}
      />
      {value.name}
    </span>
  );
}
