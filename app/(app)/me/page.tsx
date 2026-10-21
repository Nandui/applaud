import Link from "next/link";
import { Gift, Send, Inbox, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getAllowanceStatus } from "@/lib/points";
import { ledgerTypeMeta } from "@/lib/ledger";
import { formatNumber, formatSigned } from "@/lib/format";
import { relativeTime } from "@/lib/datetime";
import { AppBar } from "@/components/app-shell/app-bar";
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

  // Remaining allowance as a ring.
  const remainingPct = 100 - usedPct;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="mx-auto max-w-xl">
      <AppBar title="Wallet" center leading={<BackButton fallback="/profile" />} />

      {/* Balance and the two things you can do with points */}
      <section className="flex flex-col items-center pt-4 pb-6 text-center">
        <p className="text-muted text-sm font-semibold">Redeemable balance</p>
        <p className="mt-2 flex items-baseline gap-1.5 text-5xl leading-none font-bold tracking-tight">
          <span className="text-primary text-3xl" aria-hidden>
            ✦
          </span>
          <span data-numeric>{formatNumber(user.walletBalance)}</span>
        </p>
        <p className="text-muted mt-1 text-sm font-medium">points</p>
        <div className="mt-6 grid w-full grid-cols-2 gap-2">
          <Link
            href="/rewards"
            className="bg-primary text-primary-fg flex h-12 items-center justify-center gap-2 rounded-xl font-bold active:opacity-80"
          >
            <Gift className="size-4.5" /> Spend
          </Link>
          <Link
            href="/recognize"
            className="bg-surface-2 flex h-12 items-center justify-center gap-2 rounded-xl font-bold active:opacity-80"
          >
            <Send className="size-4.5" /> Give
          </Link>
        </div>
      </section>

      {/* Allowance */}
      <section className="bg-surface flex items-center gap-4 rounded-2xl p-5">
        <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - remainingPct / 100)}
          />
        </svg>
        <div className="min-w-0">
          <p className="text-muted text-sm font-semibold">Left to give this month</p>
          <p className="mt-0.5">
            <span data-numeric className="text-3xl font-bold">
              {formatNumber(allowance.remaining)}
            </span>{" "}
            <span className="text-muted text-sm">/ {formatNumber(allowance.total)} pts</span>
          </p>
          <p className="text-muted mt-1 text-xs leading-snug">
            Resets on the 1st and doesn&apos;t roll over, so use it!
          </p>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl p-4">
          <Inbox className="text-primary size-5" />
          <p data-numeric className="mt-2 text-3xl font-bold">
            {formatNumber(receivedCount)}
          </p>
          <p className="text-muted text-xs font-medium">shout-outs received</p>
        </div>
        <div className="bg-surface rounded-2xl p-4">
          <Send className="text-primary size-5" />
          <p data-numeric className="mt-2 text-3xl font-bold">
            {formatNumber(givenCount)}
          </p>
          <p className="text-muted text-xs font-medium">shout-outs given</p>
        </div>
      </div>

      {/* Activity */}
      <h2 className="mt-7 mb-1 text-[0.95rem] font-bold">Activity</h2>
      {ledger.length === 0 ? (
        <p className="bg-surface text-muted rounded-2xl px-6 py-10 text-center text-sm">
          No wallet activity yet. Points you receive will show up here.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {ledger.map((row) => {
            const meta = ledgerTypeMeta(row.type);
            const up = row.amount > 0;
            return (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    up ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted",
                  )}
                >
                  {up ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-semibold">{row.note ?? meta.label}</p>
                  <p className="text-muted text-xs">
                    {meta.label} · {relativeTime(row.createdAt)}
                  </p>
                </div>
                <span
                  data-numeric
                  className={cn(
                    "shrink-0 font-bold",
                    up ? "text-primary" : row.amount < 0 ? "text-foreground" : "text-muted",
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
