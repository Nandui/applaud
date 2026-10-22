/**
 * Re-mounts on every navigation, so each screen eases in like a native push.
 * Opacity + a few pixels of lift only: enough to feel fluid, short enough
 * (180ms) to never feel slow. Plain CSS (".page-in" in globals.css), so no
 * animation library loads on every screen; skipped with reduced motion.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
