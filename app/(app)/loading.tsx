import { ScreenSkeleton } from "@/components/app-shell/screen-skeleton";

/**
 * Shown the moment a tab or link is tapped (and prefetched with the link), so
 * navigation answers instantly instead of waiting on the server.
 */
export default function Loading() {
  return <ScreenSkeleton />;
}
