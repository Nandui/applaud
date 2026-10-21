"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, type NavItem } from "@/components/app-shell/nav-config";

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0"
    >
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors md:h-auto md:gap-2.5 md:rounded-md md:py-2 md:font-medium",
              active
                ? "bg-foreground md:bg-primary/10 md:text-primary text-white"
                : "bg-secondary md:text-muted md:hover:text-foreground md:hover:bg-secondary md:bg-transparent",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
