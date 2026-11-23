import Link from "next/link";
import { ChevronRight, Hourglass } from "lucide-react";
import { isWalletExpiryMonth, walletExpiryPhrase } from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Points expire on 31 Dec" under a balance. Quiet for most of the year; in
 * December it turns into a reminder with the number of points and days left.
 * Renders nothing when expiry is switched off in Admin > Economy.
 */
export function WalletExpiryNote({
  balance,
  enabled,
  className,
  now = new Date(),
}: {
  balance: number;
  enabled: boolean;
  className?: string;
  now?: Date;
}) {
  if (!enabled) return null;
  if (!isWalletExpiryMonth(now)) {
    return (
      <p className={cn("text-muted text-xs", className)}>
        Points you don&apos;t spend expire on 31 Dec.
      </p>
    );
  }
  if (balance <= 0) return null;
  return (
    <p
      className={cn(
        "bg-warning/12 text-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        className,
      )}
    >
      <Hourglass className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span data-numeric>{formatNumber(balance)}</span> {balance === 1 ? "point" : "points"}{" "}
        {walletExpiryPhrase(now).replace("expire", balance === 1 ? "expires" : "expire")}
      </span>
    </p>
  );
}

/** December reminder on Home: spend your points before they expire. */
export function WalletExpiryHomeRow({
  balance,
  enabled,
  now = new Date(),
}: {
  balance: number;
  enabled: boolean;
  now?: Date;
}) {
  if (!enabled || balance <= 0 || !isWalletExpiryMonth(now)) return null;
  const phrase = walletExpiryPhrase(now);
  return (
    <Link href="/rewards" className="border-border flex items-center gap-3 border-b py-3 active:opacity-70">
      <span className="bg-warning/12 text-warning flex size-10 shrink-0 items-center justify-center rounded-full">
        <Hourglass className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold">
          Your <span data-numeric>{formatNumber(balance)}</span> {balance === 1 ? "point" : "points"}{" "}
          {phrase.replace("expire", balance === 1 ? "expires" : "expire")}
        </span>
        <span className="text-muted block truncate text-sm">
          Spend {balance === 1 ? "it" : "them"} before 31 Dec
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  );
}
