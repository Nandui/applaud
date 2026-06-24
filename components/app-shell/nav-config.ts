import {
  LayoutGrid,
  Trophy,
  Award,
  Gift,
  Wallet,
  Users,
  Building2,
  Heart,
  BadgeCheck,
  PackageOpen,
  CalendarHeart,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/config";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role required to see this item. Defaults to "staff". */
  minRole?: Role;
  /** Match the route exactly (for "/") instead of by prefix. */
  exact?: boolean;
};

/** Primary top-nav links for the main app. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Feed", icon: LayoutGrid, exact: true },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/awards", label: "Awards", icon: Award },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/me", label: "My wallet", icon: Wallet },
];

/** Admin sidebar links — all require the admin role. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, minRole: "admin", exact: true },
  { href: "/admin/users", label: "Users", icon: Users, minRole: "admin" },
  { href: "/admin/sites", label: "Sites", icon: Building2, minRole: "admin" },
  { href: "/admin/values", label: "Values", icon: Heart, minRole: "admin" },
  { href: "/admin/awards", label: "Award programs", icon: Award, minRole: "admin" },
  { href: "/admin/nominations", label: "Nominations", icon: BadgeCheck, minRole: "admin" },
  { href: "/admin/rewards", label: "Rewards", icon: Gift, minRole: "admin" },
  { href: "/admin/redemptions", label: "Redemptions", icon: PackageOpen, minRole: "admin" },
  { href: "/admin/milestones", label: "Milestones", icon: CalendarHeart, minRole: "admin" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, minRole: "admin" },
  { href: "/admin/settings", label: "Settings", icon: Settings, minRole: "admin" },
];
