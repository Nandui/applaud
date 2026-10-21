"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type ManagerOption = { id: string; name: string };

// A plain checkbox list rather than a multi-select dropdown: the list lives in
// the page (no portal, no popup) so it keeps working inside the user dialog,
// and several people can be ticked without the list closing between picks.
export function ManagerPicker({
  options,
  value,
  onChange,
  emptyLabel = "Nobody to pick from yet.",
}: {
  options: ManagerOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () =>
      value
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is ManagerOption => !!o),
    [value, options],
  );

  const needle = query.trim().toLowerCase();
  // Filtering only hides rows; the order never changes as people are ticked, so
  // a name never moves out from under the pointer mid-click.
  const shown = needle
    ? options.filter((o) => o.name.toLowerCase().includes(needle))
    : options;

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <span
              key={m.id}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium"
            >
              {m.name}
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => toggle(m.id)}
                className="hover:bg-background/60 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-input overflow-hidden rounded-md border">
        {options.length > 6 && (
          <div className="border-input border-b p-1.5">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="h-8 border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              aria-label="Search managers"
            />
          </div>
        )}
        <div
          role="group"
          aria-label="Managers"
          className="max-h-48 overflow-y-auto p-1"
        >
          {shown.length === 0 && (
            <p className="text-muted px-2 py-3 text-sm">
              {options.length === 0 ? emptyLabel : "No match."}
            </p>
          )}
          {shown.map((m) => {
            const checked = value.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(m.id)}
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "border-input flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                    checked && "bg-primary border-primary text-primary-foreground",
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <span className="truncate">{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
