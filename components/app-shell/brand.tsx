import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";
import logo from "@/public/brand/yayup-logo.png";
import logoDark from "@/public/brand/yayup-logo-dark.png";

/**
 * The Yayup logo (mark + "yayup"). Sized by font size like text: the image is
 * 1.15em tall. The dark-mode copy has white lettering.
 */
export function Wordmark({ className }: { className?: string }) {
  const img = "h-[1.15em] w-auto";
  return (
    <span className={cn("inline-flex items-center text-[1.6rem] leading-none", className)}>
      <Image src={logo} alt={APP_NAME} unoptimized preload className={cn(img, "dark:hidden")} />
      <Image src={logoDark} alt={APP_NAME} unoptimized className={cn(img, "hidden dark:block")} />
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
