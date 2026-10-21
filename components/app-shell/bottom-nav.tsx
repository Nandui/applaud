"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, Gift, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import type { SessionUser } from "@/lib/auth/types";

/** Routes that take over the whole screen (no tab bar), like a native modal. */
export const FULL_SCREEN = ["/recognize", "/profile/edit"];

/**
 * Phone tab bar: a floating frosted dock (the current iOS / Opal look) with
 * four destinations and a raised gradient Send button in the thumb zone.
 * Hidden on desktop, where the SideNav takes over.
 */
export function BottomNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  if (FULL_SCREEN.some((p) => pathname.startsWith(p))) return null;

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const onProfile = pathname === `/profile/${user.id}` || active("/me");
  const onRanks = active("/leaderboard") || active("/awards");

  return (
    <nav
      aria-label="Main"
      className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
    >
      <div className="border-border pointer-events-auto mx-auto mb-2 flex h-16 max-w-md items-center justify-around rounded-[1.75rem] border bg-[var(--tabbar)] px-1.5 shadow-float backdrop-blur-xl backdrop-saturate-150">
        <Tab href="/" label="Home" active={active("/", true)}>
          <House className="size-[1.4rem]" />
        </Tab>
        <Tab href="/leaderboard" label="Ranks" active={onRanks}>
          <Trophy className="size-[1.4rem]" />
        </Tab>

        <Link
          href="/recognize"
          aria-label="Send a shout-out"
          className="flex flex-1 items-center justify-center"
        >
          <motion.span
            whileTap={{ scale: 0.88 }}
            className="bg-brand flex size-12 items-center justify-center rounded-full text-white shadow-[0_6px_20px_-4px_rgb(209_77_255/0.7)]"
          >
            <Plus className="size-6" strokeWidth={2.75} />
          </motion.span>
        </Link>

        <Tab href="/rewards" label="Rewards" active={active("/rewards")}>
          <Gift className="size-[1.4rem]" />
        </Tab>
        <Tab href={`/profile/${user.id}`} label="You" active={onProfile}>
          <span
            className={cn(
              "rounded-full p-[2px] transition-colors",
              onProfile ? "bg-foreground" : "bg-transparent",
            )}
          >
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              className="ring-background size-6 text-[0.55rem] ring-2"
            />
          </span>
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
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-semibold transition-colors",
        active ? "text-foreground [&_svg]:stroke-[2.4]" : "text-muted [&_svg]:stroke-[1.8]",
      )}
    >
      <motion.span whileTap={{ scale: 0.85 }} className="flex h-7 items-center">
        {children}
      </motion.span>
      <span>{label}</span>
      {active && (
        <motion.span
          layoutId="tab-dot"
          className="bg-lime absolute -bottom-0.5 size-1 rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
    </Link>
  );
}
