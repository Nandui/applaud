import { valueIcon } from "@/lib/value-icons";
import { cn } from "@/lib/utils";

export type ValueChipData = {
  name: string;
  icon?: string | null;
  color?: string | null;
};

/** Convert a #rrggbb hex to an rgba() tint for subtle chip backgrounds. */
function tint(hex?: string | null, alpha = 0.12): string | undefined {
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
  const Icon = valueIcon(value.icon);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
      style={{
        color: value.color ?? undefined,
        backgroundColor: tint(value.color) ?? "var(--color-secondary)",
      }}
    >
      <Icon className="size-3.5 shrink-0" />
      {value.name}
    </span>
  );
}
