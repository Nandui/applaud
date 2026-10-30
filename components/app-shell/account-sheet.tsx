"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Menu,
  Sparkles,
  Wallet,
  PackageOpen,
  Gift,
  Award,
  Trophy,
  Shield,
  LogOut,
  ChevronRight,
  Pencil,
  Sun,
  Moon,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * The ☰ menu on your own profile (as on Instagram): appearance, every
 * secondary destination that doesn't earn a tab, and sign out.
 */
export function AccountSheet({
  admin,
  triggerClassName,
}: {
  admin: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { theme, setTheme } = useTheme();

  const themes: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "system", label: "Auto", icon: Smartphone },
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Appearance, your account and more</SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-2 pb-1">
            <p className="text-muted mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
              Appearance
            </p>
            <div className="bg-surface-2 grid grid-cols-3 gap-1 rounded-2xl p-1">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors",
                    theme === t.id ? "bg-surface shadow-sm" : "text-muted",
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <nav className="px-3 pt-2 pb-3">
            <Item href="/profile/edit" icon={Pencil} label="Edit profile" onClick={close} />
            <Item href="/me" icon={Wallet} label="Wallet & allowance" onClick={close} />
            <Item href="/shop" icon={Sparkles} label="Profile shop" onClick={close} />
            <Item href="/rewards" icon={Gift} label="Rewards" onClick={close} />
            <Item href="/rewards/claimed" icon={PackageOpen} label="My rewards" onClick={close} />
            <Item href="/awards" icon={Award} label="Awards & nominations" onClick={close} />
            <Item href="/leaderboard" icon={Trophy} label="Ranks" onClick={close} />
            {admin && <Item href="/admin" icon={Shield} label="Admin" onClick={close} />}
            <div className="bg-border mx-3 my-2 h-px" />
            <button
              type="button"
              onClick={() => void signOutAction()}
              className="text-danger active:bg-surface-2 flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-[0.95rem] font-medium"
            >
              <LogOut className="size-5.5" />
              Sign out
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Item({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="active:bg-surface-2 hover:bg-surface-2/60 flex items-center gap-3.5 rounded-xl px-3 py-3 text-[0.95rem] font-medium"
    >
      <Icon className="size-5.5" strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      <ChevronRight className="text-muted size-4.5" />
    </Link>
  );
}
