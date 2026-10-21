import { cn } from "@/lib/utils";

/**
 * A profile banner with a little life in it: the picture drifts very slowly,
 * and as the page scrolls it slides away a touch slower than the content
 * (parallax). Both are transform-only and off for reduced motion
 * (globals.css `.banner-drift` / `.banner-parallax`).
 */
export function ProfileBanner({ background, className }: { background: string; className?: string }) {
  return (
    <div className={cn("banner-frame relative overflow-hidden", className)}>
      <div className="banner-parallax absolute inset-0">
        <div className="banner-drift absolute inset-0" style={{ background }} />
      </div>
    </div>
  );
}
