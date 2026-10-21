import Link from "next/link";
import { cn } from "@/lib/utils";

/** Top-level switch between the two halves of the Ranks tab. */
export function RanksTabs({ active }: { active: "leaderboard" | "awards" }) {
  const tabs = [
    { key: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
    { key: "awards", label: "Awards", href: "/awards" },
  ] as const;
  return (
    <div className="bg-surface-2 grid grid-cols-2 rounded-full p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          replace
          className={cn(
            "flex h-9 items-center justify-center rounded-full text-sm font-bold transition-colors",
            active === t.key ? "bg-foreground text-background" : "text-muted",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
