import {
  Award,
  BadgeCheck,
  Handshake,
  HeartHandshake,
  Heart,
  Rocket,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Sun,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated set of lucide icons available for company Values. Admins pick a name
 * from this set; the feed/chips resolve the name to a component. Keeping it
 * curated (vs. loading all of lucide) keeps the bundle small and the picker tidy.
 */
export const VALUE_ICONS: Record<string, LucideIcon> = {
  HeartHandshake,
  Handshake,
  Users,
  ShieldCheck,
  Rocket,
  BadgeCheck,
  Sun,
  Star,
  Heart,
  Smile,
  Zap,
  Trophy,
  Target,
  ThumbsUp,
  Sparkles,
  Award,
};

export const VALUE_ICON_NAMES = Object.keys(VALUE_ICONS);

export function valueIcon(name?: string | null): LucideIcon {
  return (name && VALUE_ICONS[name]) || Award;
}

/** Check posted badge picks (icon name, hex colour); returns an error or null. */
export function badgeLookError(icon: string, color: string): string | null {
  if (icon && !VALUE_ICON_NAMES.includes(icon)) return "Pick an icon from the list.";
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return "Pick a colour.";
  return null;
}
