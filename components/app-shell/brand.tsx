import Link from "next/link";
import { cn } from "@/lib/utils";

/** The "applaud" wordmark: heavy Geist with a violet dot. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline text-[1.6rem] leading-none font-extrabold tracking-[-0.05em]",
        className,
      )}
    >
      applaud
      <span aria-hidden className="bg-primary ml-0.5 inline-block size-[0.32em] rounded-full" />
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
