import Link from "next/link";
import { cn } from "@/lib/utils";

/** The "applaud" wordmark with a lime spark, Bricolage at its heaviest. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-baseline text-[1.65rem] leading-none font-extrabold tracking-[-0.04em]",
        className,
      )}
    >
      applaud
      <span aria-hidden className="bg-lime ml-0.5 inline-block size-[0.32em] rounded-full" />
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
