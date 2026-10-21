"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, Gift, Wallet, Award, Shield, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/lib/auth/types";
import { UserAvatar } from "@/components/user-avatar";
import { Brand } from "./brand";
import { FULL_SCREEN } from "./bottom-nav";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Desktop navigation: a left rail like Threads / Instagram on the web. Same
 * destinations as the phone tab bar, plus the secondary ones that live in the
 * You menu on phones.
 */
export function SideNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  if (FULL_SCREEN.some((p) => pathname.startsWith(p))) return null;
  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const items: { href: string; label: string; icon: LucideIcon; on: boolean }[] = [
    { href: "/", label: "Home", icon: House, on: active("/", true) },
    { href: "/leaderboard", label: "Ranks", icon: Trophy, on: active("/leaderboard") },
    { href: "/awards", label: "Awards", icon: Award, on: active("/awards") },
    { href: "/rewards", label: "Rewards", icon: Gift, on: active("/rewards") },
    { href: "/me", label: "Wallet", icon: Wallet, on: active("/me") },
  ];
  if (isAdmin(user)) {
    items.push({ href: "/admin", label: "Admin", icon: Shield, on: active("/admin") });
  }

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-1 px-3 py-6 md:flex">
      <Brand className="mb-6 px-3" />
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.on ? "page" : undefined}
          className={cn(
            "flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-[0.95rem] transition-colors",
            item.on
              ? "bg-surface-2 font-semibold"
              : "text-muted hover:text-foreground hover:bg-surface-2/60 font-medium",
          )}
        >
          <item.icon className="size-5.5" strokeWidth={item.on ? 2.4 : 1.8} />
          {item.label}
        </Link>
      ))}
      <Link
        href="/recognize"
        className="bg-brand mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-white shadow-[0_8px_24px_-8px_rgb(209_77_255/0.7)] transition-transform active:scale-[0.98]"
      >
        <Plus className="size-5" strokeWidth={2.6} /> Send a shout-out
      </Link>
      <Link
        href={`/profile/${user.id}`}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
          active(`/profile/${user.id}`) ? "bg-surface-2" : "hover:bg-surface-2/60",
        )}
      >
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-9" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="text-muted block text-xs">View profile</span>
        </span>
      </Link>
    </aside>
  );
}
