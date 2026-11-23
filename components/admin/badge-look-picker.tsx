"use client";

import { ValueIcon } from "@/components/value-icon";
import { Label } from "@/components/ui/label";
import { VALUE_ICON_NAMES } from "@/lib/value-icons";
import { cn } from "@/lib/utils";

/** Quick colour picks that look good as holo badges in both themes. */
const COLOR_SWATCHES = [
  "#0e9aa7",
  "#5b4dff",
  "#16a34a",
  "#e11d48",
  "#0ea5e9",
  "#f59e0b",
  "#d946ef",
  "#f97316",
  "#64748b",
];

/**
 * Icon and colour picks for a holo hexagon badge (values and award programs).
 * Controlled; the parent posts the picks in hidden "icon" and "color" inputs.
 */
export function BadgeLookPicker({
  icon,
  color,
  onIconChange,
  onColorChange,
  showIcons = true,
}: {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  /** Hide the icon grid when an uploaded picture replaces the icon. */
  showIcons?: boolean;
}) {
  return (
    <>
      {showIcons && (
        <div className="space-y-1.5">
          <Label>Icon</Label>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
            {VALUE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                title={n}
                aria-label={n}
                aria-pressed={icon === n}
                onClick={() => onIconChange(n)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border-2 transition-colors",
                  icon === n ? "border-primary bg-primary/10" : "bg-surface border-transparent",
                )}
              >
                <ValueIcon icon={n} className="size-5" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="badge-color">Colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color.toLowerCase() === c}
              onClick={() => onColorChange(c)}
              className={cn(
                "ring-offset-background size-8 rounded-full ring-offset-2 transition",
                color.toLowerCase() === c ? "ring-foreground ring-2" : "",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            id="badge-color"
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="border-border size-8 cursor-pointer rounded-full border bg-transparent p-0"
            title="Any colour"
          />
        </div>
      </div>
    </>
  );
}
