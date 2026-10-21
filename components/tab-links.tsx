import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one tab pattern used everywhere (Instagram's "Followers / Following"):
 * equal-width text tabs with an underline under the active one. Each tab is a
 * link, so the choice lives in the URL and the back button works.
 */
export function TabLinks({
  tabs,
  active,
  className,
  accent,
}: {
  tabs: { key: string; label: React.ReactNode; href: string }[];
  active: string;
  className?: string;
  /** Underline colour; defaults to the foreground colour. */
  accent?: string;
}) {
  return (
    <nav className={cn("border-border flex border-b", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            replace
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex h-11 flex-1 items-center justify-center text-[0.95rem] font-semibold transition-colors",
              on ? "text-foreground" : "text-muted",
            )}
          >
            {t.label}
            {on && (
              <span
                className="bg-foreground absolute inset-x-0 -bottom-px h-[2px]"
                style={accent ? { backgroundColor: accent } : undefined}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
