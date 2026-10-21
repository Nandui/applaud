"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Plus, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import type { SessionUser } from "@/lib/auth/types";

/** Routes that take over the whole screen (no tab bar), like a native modal. */
const FULL_SCREEN = ["/recognize"];

/**
 * Phone tab bar (TikTok/Instagram pattern): four destinations plus a raised
 * gradient "create" button in the thumb zone. Frosted, safe-area padded, and
 * hidden on desktop where the TopNav takes over.
 */
export function BottomNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  if (FULL_SCREEN.some((p) => pathname.startsWith(p))) return null;

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const profileHref = `/profile/${user.id}`;
  const onProfile = active("/profile") || active("/me");

  return (
    <nav
      aria-label="Main"
      className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] md:hidden"
    >
      <div className="mx-auto flex h-[3.4rem] max-w-md items-stretch justify-around px-1">
        <Tab href="/" label="Home" active={active("/", true)}>
          <Home className="size-6" />
        </Tab>
        <Tab href="/leaderboard" label="Ranks" active={active("/leaderboard")}>
          <Trophy className="size-6" />
        </Tab>

        <Link
          href="/recognize"
          aria-label="Recognise someone"
          className="flex flex-1 items-center justify-center"
        >
          <motion.span
            whileTap={{ scale: 0.88 }}
            className="bg-brand flex h-9 w-13 items-center justify-center rounded-[0.8rem] text-white shadow-[0_4px_14px_-2px_rgb(217_70_239/0.55)]"
          >
            <Plus className="size-6" strokeWidth={2.75} />
          </motion.span>
        </Link>

        <Tab href="/rewards" label="Rewards" active={active("/rewards")}>
          <Gift className="size-6" />
        </Tab>
        <Tab href={profileHref} label="Me" active={onProfile}>
          <span
            className={cn(
              "rounded-full p-[1.5px]",
              onProfile ? "bg-foreground" : "bg-transparent",
            )}
          >
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              className="ring-surface size-[1.55rem] text-[0.55rem] ring-[1.5px]"
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
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-semibold transition-colors",
        active ? "text-foreground [&_svg]:stroke-[2.4]" : "text-muted [&_svg]:stroke-[1.75]",
      )}
    >
      <motion.span whileTap={{ scale: 0.85 }} className="flex h-7 items-center">
        {children}
      </motion.span>
      <span>{label}</span>
    </Link>
  );
}
