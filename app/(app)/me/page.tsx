import Link from "next/link";
import { Wallet, Gift, Send, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getAllowanceStatus } from "@/lib/points";
import { ledgerTypeMeta } from "@/lib/ledger";
import { formatNumber, formatSigned } from "@/lib/format";
import { relativeTime } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <div>
      <PageHeader
        title="My wallet"
        description="Your balance, monthly giving allowance, and activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Wallet balance */}
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Wallet className="size-4.5" />
              </span>
              <span className="text-muted text-sm font-medium">
                Redeemable balance
              </span>
            </div>
            <p data-numeric className="text-4xl font-semibold tracking-tight">
              {formatNumber(user.walletBalance)}
              <span className="text-muted ml-1.5 text-base font-normal">pts</span>
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/rewards">
                <Gift className="size-4" /> Spend on rewards
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Allowance */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted text-sm font-medium">
                Giving allowance this month
              </span>
              <span className="text-sm">
                <span data-numeric className="text-foreground font-semibold">
                  {formatNumber(allowance.remaining)}
                </span>{" "}
                <span className="text-muted">
                  / {formatNumber(allowance.total)} left
                </span>
              </span>
            </div>
            <div className="bg-secondary h-2.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-muted text-xs">
              Allowance is your budget for recognising others. It resets at the
              start of each month and doesn&apos;t roll over.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="border-border flex items-center gap-2 rounded-lg border p-3">
                <Inbox className="text-accent size-4" />
                <div>
                  <p data-numeric className="font-semibold">
                    {formatNumber(receivedCount)}
                  </p>
                  <p className="text-muted text-xs">recognitions received</p>
                </div>
              </div>
              <div className="border-border flex items-center gap-2 rounded-lg border p-3">
                <Send className="text-primary size-4" />
                <div>
                  <p data-numeric className="font-semibold">
                    {formatNumber(givenCount)}
                  </p>
                  <p className="text-muted text-xs">recognitions given</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Wallet activity</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-muted py-6 text-center text-sm">
              No wallet activity yet. Points you receive will show up here.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {ledger.map((row) => {
                const meta = ledgerTypeMeta(row.type);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.note ?? meta.label}
                      </p>
                      <p className="text-muted text-xs">
                        {meta.label} · {relativeTime(row.createdAt)}
                      </p>
                    </div>
                    <span
                      data-numeric
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        row.amount > 0
                          ? "text-success"
                          : row.amount < 0
                            ? "text-danger"
                            : "text-muted",
                      )}
                    >
                      {formatSigned(row.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
