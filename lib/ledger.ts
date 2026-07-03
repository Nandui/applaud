import type { LedgerType } from "@/lib/config";

export const LEDGER_TYPE_META: Record<
  LedgerType,
  { label: string; tone: "earn" | "spend" | "neutral" }
> = {
  RECOGNITION: { label: "Recognition", tone: "earn" },
  AWARD: { label: "Award", tone: "earn" },
  REDEMPTION: { label: "Redemption", tone: "spend" },
  EXPIRY: { label: "Expiry", tone: "spend" },
  ADJUSTMENT: { label: "Adjustment", tone: "neutral" },
  BOOST: { label: "Boost", tone: "earn" },
};

export function ledgerTypeMeta(type: string) {
  return (
    LEDGER_TYPE_META[type as LedgerType] ?? {
      label: type,
      tone: "neutral" as const,
    }
  );
}
