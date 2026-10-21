import Link from "next/link";
import { cn } from "@/lib/utils";
import { MARK_HEAD, MARK_STROKE, MARK_STROKE_WIDTH } from "@/lib/pwa/mark";

/** The Yayup mark (a cheering "Y") in white on a violet tile. */
export function Mark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary inline-flex size-[1.1em] shrink-0 items-center justify-center rounded-[0.3em] text-white",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[0.86em]">
        <path
          d={MARK_STROKE}
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={MARK_HEAD.cx} cy={MARK_HEAD.cy} r={MARK_HEAD.r} fill="currentColor" />
      </svg>
    </span>
  );
}

/** The "yayup" wordmark: the mark, then heavy lowercase Geist. */
export function Wordmark({
  className,
  withMark = true,
}: {
  className?: string;
  /** Hide the mark where it already appears big beside the wordmark. */
  withMark?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.28em] text-[1.6rem] leading-none font-extrabold tracking-[-0.05em]",
        className,
      )}
    >
      {withMark && <Mark />}
      <span className="-mt-[0.12em]">yayup</span>
    </span>
  );
}

export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} aria-label="Home" className={cn("flex items-center", className)}>
      <Wordmark />
    </Link>
  );
}
