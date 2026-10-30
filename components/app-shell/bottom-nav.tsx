"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, ShoppingBag, SquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import type { SessionUser } from "@/lib/auth/types";
import { NewDot } from "./new-items";

/** Routes that take over the whole screen (no tab bar), like a native modal. */
export const FULL_SCREEN = ["/recognize", "/post", "/profile/edit"];

/**
 * Phone tab bar, the plain Instagram one: full width, hairline on top, five
 * destinations with Send in the middle. Hidden on desktop (SideNav).
 */
export function BottomNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  if (FULL_SCREEN.some((p) => pathname.startsWith(p))) return null;

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const onProfile = pathname === `/profile/${user.id}` || active("/me");
  const onRanks = active("/leaderboard") || active("/awards");
  const onStore = active("/rewards") || active("/shop");

  return (
    <nav
      aria-label="Main"
      className="border-border pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--tabbar)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-14 max-w-md items-stretch">
        <Tab href="/" label="Home" active={active("/", true)}>
          <House className="size-6" />
        </Tab>
        <Tab href="/leaderboard" label="Ranks" active={onRanks}>
          <Trophy className="size-6" />
        </Tab>
        <Tab href="/recognize" label="Send" active={false}>
          <SquarePlus className="size-6" />
        </Tab>
        <Tab href="/rewards" label="Store" active={onStore}>
          <span className="relative">
            <ShoppingBag className="size-6" />
            <NewDot areas={["shop", "rewards", "claims"]} className="ring-background absolute -top-0.5 -right-0.5 ring-2" />
          </span>
        </Tab>
        <Tab href={`/profile/${user.id}`} label="Profile" active={onProfile}>
          <UserAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            className={cn(
              "size-6 text-[0.55rem]",
              onProfile && "ring-foreground ring-offset-background ring-2 ring-offset-1",
            )}
          />
        </Tab>
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium transition-colors active:opacity-60",
        active ? "text-foreground [&_svg]:stroke-[2.5]" : "text-muted [&_svg]:stroke-[1.75]",
      )}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
