import Link from "next/link";
import { Wallet, Gift, Send, Inbox, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getAllowanceStatus } from "@/lib/points";
import { ledgerTypeMeta } from "@/lib/ledger";
import { formatNumber, formatSigned } from "@/lib/format";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/app-shell/back-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My wallet" };

export default async function MePage() {
  const me = await requireUser();
  const settings = await getOrgSettings();

  const [user, allowance, ledger, receivedCount, givenCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { walletBalance: true },
    }),
    getAllowanceStatus(me, settings),
    prisma.rewardLedger.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.recognitionRecipient.count({ where: { userId: me.id } }),
    prisma.recognition.count({ where: { senderId: me.id, system: false } }),
  ]);

  const usedPct =
    allowance.total > 0
      ? Math.min(100, Math.round((allowance.used / allowance.total) * 100))
      : 0;

  // Remaining allowance as a ring, Apple Fitness style.
  const remainingPct = 100 - usedPct;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="My wallet"
        description="Your balance, monthly giving allowance, and activity."
        leading={<BackButton fallback="/profile" />}
      />

      {/* Balance card */}
      <section className="bg-foreground relative overflow-hidden rounded-3xl p-5 text-white">
        <div className="bg-brand absolute -top-16 -right-16 size-48 rounded-full opacity-60 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-medium text-white/70">
            <Wallet className="size-4" /> Redeemable balance
          </p>
          <p data-numeric className="mt-2 text-[2.75rem] leading-none font-semibold tracking-tight">
            {formatNumber(user.walletBalance)}
            <span className="ml-1.5 text-lg font-normal text-white/60">pts</span>
          </p>
          <Link
            href="/rewards"
            className="text-foreground mt-5 flex h-11 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold transition-transform active:scale-[0.98]"
          >
            <Gift className="size-4" /> Spend on rewards
          </Link>
        </div>
      </section>

      {/* Allowance */}
      <section className="bg-surface mt-3 flex items-center gap-4 rounded-3xl p-5">
        <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="allowance-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-1)" />
              <stop offset="100%" stopColor="var(--color-brand-3)" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-secondary)" strokeWidth="9" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="url(#allowance-ring)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - remainingPct / 100)}
          />
        </svg>
        <div className="min-w-0">
          <p className="text-muted text-sm font-medium">Left to give this month</p>
          <p className="mt-0.5">
            <span data-numeric className="text-2xl font-semibold">
              {formatNumber(allowance.remaining)}
            </span>{" "}
            <span className="text-muted text-sm">/ {formatNumber(allowance.total)} pts</span>
          </p>
          <p className="text-muted mt-1 text-xs leading-snug">
            Resets on the 1st and doesn&apos;t roll over — use it!
          </p>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-3xl p-4">
          <Inbox className="text-accent size-5" />
          <p data-numeric className="mt-2 text-2xl font-semibold">
            {formatNumber(receivedCount)}
          </p>
          <p className="text-muted text-xs">recognitions received</p>
        </div>
        <div className="bg-surface rounded-3xl p-4">
          <Send className="text-primary size-5" />
          <p data-numeric className="mt-2 text-2xl font-semibold">
            {formatNumber(givenCount)}
          </p>
          <p className="text-muted text-xs">recognitions given</p>
        </div>
      </div>

      {/* Activity */}
      <h2 className="font-display mt-6 mb-2 px-1 text-lg font-semibold">Activity</h2>
      {ledger.length === 0 ? (
        <p className="bg-surface text-muted rounded-3xl px-6 py-10 text-center text-sm">
          No wallet activity yet. Points you receive will show up here.
        </p>
      ) : (
        <ul className="bg-surface divide-border divide-y overflow-hidden rounded-3xl">
          {ledger.map((row) => {
            const meta = ledgerTypeMeta(row.type);
            const up = row.amount > 0;
            return (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    up ? "bg-success/10 text-success" : row.amount < 0 ? "bg-danger/10 text-danger" : "bg-secondary text-muted",
                  )}
                >
                  {up ? <ArrowDownLeft className="size-4.5" /> : <ArrowUpRight className="size-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.note ?? meta.label}</p>
                  <p className="text-muted text-xs">
                    {meta.label} · {relativeTime(row.createdAt)}
                  </p>
                </div>
                <span
                  data-numeric
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    up ? "text-success" : row.amount < 0 ? "text-foreground" : "text-muted",
                  )}
                >
                  {formatSigned(row.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
