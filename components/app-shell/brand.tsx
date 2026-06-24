import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 font-display", className)}
    >
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg shadow-sm">
        <Sparkles className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
