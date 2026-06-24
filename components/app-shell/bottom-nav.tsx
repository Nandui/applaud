"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Plus, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Instagram/Facebook-style bottom tab bar for mobile. Desktop keeps the top
 * nav (this is `md:hidden`). The center "+" is the elevated create action.
 */
export function BottomNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const profileHref = `/profile/${user.id}`;

  return (
    <nav className="bg-surface/90 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        <Tab href="/" label="Home" active={active("/", true)}>
          <Home className="size-5.5" />
        </Tab>
        <Tab href="/leaderboard" label="Ranks" active={active("/leaderboard")}>
          <Trophy className="size-5.5" />
        </Tab>

        <Link
          href="/recognize"
          aria-label="Recognise"
          className="bg-primary text-primary-foreground ring-surface -mt-6 flex size-13 shrink-0 items-center justify-center rounded-full shadow-lg ring-4 transition-transform active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </Link>

        <Tab href="/awards" label="Awards" active={active("/awards")}>
          <Award className="size-5.5" />
        </Tab>
        <Link
          href={profileHref}
          className={cn(
            "flex w-14 flex-col items-center gap-0.5 text-[0.6rem] font-medium",
            active("/profile") ? "text-primary" : "text-muted",
          )}
        >
          <UserAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            className={cn(
              "size-6",
              active("/profile") && "ring-primary ring-2 ring-offset-1",
            )}
          />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-14 flex-col items-center gap-0.5 text-[0.6rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted hover:text-foreground",
      )}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
