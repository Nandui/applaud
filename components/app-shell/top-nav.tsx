"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";
import { UserMenu, SignedOutButton } from "./user-menu";
import { PRIMARY_NAV, type NavItem } from "./nav-config";
import type { SessionUser } from "@/lib/auth/types";

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function TopNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  return (
    // Desktop only — phones use the per-screen AppBar and the BottomNav.
    <header className="glass border-border sticky top-0 z-40 hidden border-b md:block">
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Brand />

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-foreground hover:bg-secondary",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button asChild size="sm" className="bg-brand rounded-full border-0 text-white hover:opacity-90">
                <Link href="/recognize">
                  <Plus className="size-4" /> Recognise
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <SignedOutButton />
          )}

        </div>
      </div>
    </header>
  );
}
