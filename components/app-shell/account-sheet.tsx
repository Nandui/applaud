"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Wallet,
  Gift,
  Award,
  Trophy,
  Shield,
  LogOut,
  ChevronRight,
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
import { appBarIconClass } from "./app-bar";

/**
 * The hamburger on your own profile (Instagram's settings sheet): every
 * secondary destination that doesn't earn a tab, plus sign out.
 */
export function AccountSheet({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        className={appBarIconClass}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Your account and more</SheetDescription>
          </SheetHeader>
          <nav className="px-3 pt-1 pb-3">
            <Item href="/me" icon={Wallet} label="My wallet" onClick={close} />
            <Item href="/rewards" icon={Gift} label="Rewards" onClick={close} />
            <Item href="/awards" icon={Award} label="Awards & nominations" onClick={close} />
            <Item href="/leaderboard" icon={Trophy} label="Leaderboard" onClick={close} />
            {admin && <Item href="/admin" icon={Shield} label="Admin" onClick={close} />}
            <div className="bg-border mx-3 my-2 h-px" />
            <button
              type="button"
              onClick={() => void signOutAction()}
              className="text-danger active:bg-secondary flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-[0.95rem] font-medium"
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
      className="active:bg-secondary flex items-center gap-3.5 rounded-xl px-3 py-3 text-[0.95rem] font-medium"
    >
      <Icon className="size-5.5" strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      <ChevronRight className="text-muted size-4.5" />
    </Link>
  );
}
