import Link from "next/link";
import {
  Users,
  BadgeCheck,
  PackageOpen,
  MessageSquare,
  Gift,
  BarChart3,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [users, recognitions, pendingNominations, openRedemptions, rewards] =
    await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.recognition.count({ where: { system: false } }),
      prisma.nomination.count({ where: { status: "pending" } }),
      prisma.redemption.count({
        where: { status: { in: ["requested", "approved"] } },
      }),
      prisma.reward.count({ where: { active: true } }),
    ]);

  const tiles = [
    { href: "/admin/users", label: "Active people", value: users, icon: Users, tone: "text-primary" },
    { href: "/", label: "Recognitions", value: recognitions, icon: MessageSquare, tone: "text-accent" },
    { href: "/admin/nominations", label: "Pending nominations", value: pendingNominations, icon: BadgeCheck, tone: "text-warning" },
    { href: "/admin/redemptions", label: "Open redemptions", value: openRedemptions, icon: PackageOpen, tone: "text-warning" },
    { href: "/admin/rewards", label: "Active rewards", value: rewards, icon: Gift, tone: "text-accent" },
  ];

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Configure the platform and work the fulfilment queues."
        action={
          <Link
            href="/admin/analytics"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <BarChart3 className="size-4" /> View analytics
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href + t.label} href={t.href}>
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="flex items-center gap-4">
                <span className={`bg-secondary flex size-11 items-center justify-center rounded-lg ${t.tone}`}>
                  <t.icon className="size-5" />
                </span>
                <div>
                  <p data-numeric className="text-2xl font-semibold">
                    {formatNumber(t.value)}
                  </p>
                  <p className="text-muted text-sm">{t.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
