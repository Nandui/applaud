import { ScreenSkeleton } from "@/components/app-shell/screen-skeleton";

/** Admin pages keep their sidebar and bar; only the page area shows a placeholder. */
export default function AdminLoading() {
  return <ScreenSkeleton bar={false} />;
}
